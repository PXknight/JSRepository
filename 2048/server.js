var http = require("http");
var url = require("url");
var qs = require("querystring");
var fs = require("fs");
 
http.createServer(function (req , res) {

  res.setHeader("Access-Control-Allow-Origin","*");
  if(req.method == "POST"){

    var result = "";

    var pathName = url.parse(req.url).pathname;
    req.addListener("data",function (chunk) {
      result += chunk;
    });
 
    req.on("end" , function () {
      var user = qs.parse(result);

      if(user.username){
        fs.readFile("D:\\2017first\\JavaScript\\bigTest\\2048\\database.txt" , "utf-8" , function (err,data) {
          if (!err){
            console.log("读取文件成功");
            if (!data){
              if(pathName == "/login"){
                res.end("用户名密码不存在");
                return;
              }

              if(pathName == "/register"){

                var arr = [];
                var obj = {};

                obj.username = user.username;
                obj.password = user.password;
                arr.push(obj);

                fs.writeFileSync("D:\\2017first\\JavaScript\\bigTest\\2048\\database.txt" , JSON.stringify(arr) , "utf-8");
                res.end("注册成功!");
                return;
              }
            }else {

              var arr = JSON.parse(data);

              for(var i = 0;i < arr.length;i++){
                var obj = arr[i];
                if(obj.username == user.username){
                  if(pathName == "/login"){
                    if (obj.password == user.password){
                      res.end("登录成功!");
                      return;
                    }else {
                      res.end("密码错误！");
                      return;
                    }
                  }
                  if(pathName == "/register"){
                    res.end("该用户已存在!");
                    return;
                  }
                }
              }

              if(pathName == "/login"){
                res.end("用户名不存在!");
                return;
              }

              if(pathName == "/register"){

                var obj = {};
                obj.username = user.username;
                obj.password = user.password;
                arr.push(obj);
                fs.writeFileSync("D:\\2017first\\JavaScript\\bigTest\\2048\\database.txt" , JSON.stringify(arr) , "utf-8");
                res.end("注册成功!");
                return;
              }
            }
          }else {
            console.log("读取文件失败");
          }
        })
      }
    });
  }else {
    res.end("get请求");
  }
}).listen(3000 , function (err) {
  if (!err){
    console.log("服务器启动成功，正在监听port3000...");
  }
});