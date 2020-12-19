const express = require('express');
const fs = require('fs');
const path = require('path');
const app = new express();
const port = 8000;
const dirPath = './';

function back(res, msg) {
  let body = {
    errcode: 0,
    errmsg: ''
  }
  if (typeof msg === 'number') {
    body.errcode = msg;
    switch(msg) {
      case 400:
        body.errmsg = '参数错误';
        break;
      case 404:
        body.errmsg = '数据不存在';
        break;
      case 405:
        body.errmsg = '请先清除类目下的图片';
        break;
      default:
    }
  } else if (msg) {
    body.info = msg;
  }
  res.json(body);
}
app.use(express.static('./'))
app.use(express.json({limit: '20mb'}));

app.del('/image', (req, res) => {
  let {className, imageId} = req.query;
  let imgPath = path.join(dirPath, 'images', className, imageId);
  if (!fs.existsSync(imgPath)) {
    back(res, 404);
  } else {
    fs.unlinkSync(imgPath);
    back(res);
  }
})

app.get('/image', (req, res) => {
  let dir = fs.readdirSync('./images');
  let resBody = [];
  for (let i = 0; i < dir.length; i++) {
    let tar = {};
    let className = dir[i];
    tar.className = className;
    tar.images = fs.readdirSync('./images/' + className);
    resBody.push(tar);
  }
  back(res, resBody);
})

app.post('/image', (req, res) => {
  let { className } = req.query;
  // 参数校验
  if (!className) {
    return back(res, 400);
  }
  let tarDirPath = path.join(dirPath, 'images', className);
  // 文件夹是否存在校验
  if (!fs.existsSync(tarDirPath)) {
    fs.mkdirSync(tarDirPath);
  }
  if (req.body.base64 instanceof String) {
    req.body.base64 = [req.body.base64];
  }
  let base64s = req.body.base64;
  for (let i = 0; i < base64s.length; i++) {
    let base64 = base64s[i];
    let fileName = Date.now() + '_' + (fs.readdirSync(tarDirPath).length + 1) + '.jpg';
    fs.writeFileSync(path.join(tarDirPath, fileName), Buffer.from(base64.replace(/^.*base64/,''), 'base64'));
  }
  back(res)
})

app.post('/class', (req, res) => {
  let { className } = req.query;
  // 参数校验
  if (!className) {
    return back(res, 400);
  }
  let tarDirPath = path.join(dirPath, 'images', className);
  // 文件夹是否存在校验
  if (!fs.existsSync(tarDirPath)) {
    fs.mkdirSync(tarDirPath);
  }
  back(res)
})
app.del('/class', (req, res) => {
  let { className } = req.query;
  // 参数校验
  if (!className) {
    return back(res, 400);
  }
  let tarDirPath = path.join(dirPath, 'images', className);
  // 文件夹是否存在校验
  if (fs.existsSync(tarDirPath)) {
    if (fs.readdirSync(tarDirPath).length) {
      back(res, 405);
    } else {
      fs.rmdirSync(tarDirPath);
      back(res);
    }
  } else {
    back(res, 404);
  }
})
app.get('/class', (req, res) => {
  let dir = fs.readdirSync('./images');
  back(res, dir);
})

app.listen(port)

console.log('Host listen at', port);