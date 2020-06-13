/*
	TextStream.js
	
	auth: LEORChn
	desc: process a super large text file with readline().
	created: 2020-6-11 11:54 UTC+8
	finished_v1: 2020-6-13 16:06 UTC+8
	required: baseLib.js
*/

var TextStream = function(file, removeCR){
	if(this == window) return;
	if(type(file) != 'File'){
		console.error('TextStream() must input a File for the first argument, but have: ' + type(file));
		return;
	}
	if(removeCR === false) _rmcr = false;
	
	var fr = new FileReader(),
		rmcr = true,
		buff = {
			start: 0,
			limit: 10 * 1024 * 1024, // by default read in a batch of  [[ 10 MB ]]
			lastline: [],
			body: null, // 如果是首次读取，此处应该为 null。见 this.readline() -> new Promise() -> var readNextBuffer() -> 读取开始前，指针起始位置的变更方法
			pointer: 0
		};
	this.readline = function(){
		return new Promise(function(success, fail){
			var readNextBuffer = function(){
				buff.start += buff.body == null? 0: buff.limit; // 如果文件是首次读取，指针起始点【+0】，否则【+读取限额值】
				var buffend = buff.start + buff.limit;
				fr.readAsArrayBuffer(file.slice(buff.start, buffend));
			}, readFromUTF8 = function(e){
				var uri = '';
				e.foreach(function(e){
					uri += '%' + (e<16? '0': '') + e.toString(16); // 括号内用于不足位时补零，以保证 decodeURIComponent 能够以正确格式转换
				});
				return decodeURIComponent(uri);
			};
			switch(true){
				case buff.body == null:
				case buff.pointer == buff.body.length-1:
					var holdingCR = false; // 回车符缓存区放到轮询之外，以确保在处理下一批数据时共享缓存区
					fr.onload = function(){
						var a = new Uint8Array(fr.result);
						buff.body = []; // 新读取一批数据，清空字符串组缓存
						for(var i=0; i<a.length; i++){
							switch(a[i]){
								case 0xd: // CR
									/* 
										如果需要在换行符之前移除回车符，那么
										1.先检查回车符缓存是否存储了一个回车符
										2.如果已存储回车符，此时再遇到一个回车符就输出一个回车符
										3.如果未存储回车符，那么就存储这个回车符留到下一个字符再进行处理
										TODO: 如果回车符是最后一个字符怎么办？
									*/
									if((!holdingCR) && rmcr){
										holdingCR = true;
									}else{
										buff.lastline.push(0xd);
									}
									break;
								case 0xa: // LF
									/*
										如果运行到此处，那么：
										1.当前字符是换行符
										2.上一个字符可能是回车符（如果 holdingCR == true）
										3.如果需要在换行符之前移除回车符，并且上一个字符是回车符，清空回车符缓存
										4.推送切割字符串到组，然后清空字符串缓存
									*/
									if(rmcr) holdingCR = false;
									if(holdingCR) buff.lastline.push(0xd);
									buff.body.push(buff.lastline);
									buff.lastline = [];
									break;
								default:
									/*
										如果运行到此处，那么：
										1.当前字符不是换行符
										2.上一个字符可能是回车符（如果 holdingCR == true）
										3.如果上一个字符是回车符，先输出回车符
										4.输出当前字符
									*/
									if(holdingCR){
										buff.lastline.push(0xd);
										holdingCR = false;
									}
									buff.lastline.push(a[i]);
							}
						}
						
						if(a.length > 0){
							if(buff.body.length == 0){ // 如果没有遇到换行符
								readNextBuffer(); // 读取下一批数据直到达到限额
								return;
							}
						}else{ // a.length == 0，表示没有更多数据了。
							if(holdingCR){ // 尝试释放最后一个CR
								buff.lastline.push(0xd);
							}
							if(buff.lastline.length == 0){ // 完全没有任何数据了，永久返回null
								success(null);
							}
							buff.body = [buff.lastline];
						}
						
						buff.pointer = 0; // 表示索引0（本批数据的第1行）已被读取过
						success(readFromUTF8(buff.body[0]));
					};
					readNextBuffer();
					break;
				default:
					buff.pointer++; // 本批数据还有没读完的，继续读
					success(readFromUTF8(buff.body[buff.pointer]));
			}
		});
	};
};

function testcase(){
	var t = new TextStream(f[0]);
	var fun = function(){
		t.readline().then(function(e){ // readline() return a Promise object, so use then() to receive when finish reading
			if(e == null) return; // break if meet null
			
			pl(e); // process your text line here
			
			fun(); // loop calling it
		});
	};
	fun();
}
