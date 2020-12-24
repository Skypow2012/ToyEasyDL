const express = require('express');
const { getVec } = require('./callPy.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const jimp = require("jimp");

const app = new express();
const port = 8000;
const dirPath = './';
const imagesPath = path.join(dirPath, 'images');
const imagesInfoPath = path.join(dirPath, 'imagesInfo');
const modelsPath = path.join(dirPath, 'models');
const paramModelsPath = path.join(dirPath, 'param-models');
const inferPath = path.join(dirPath, 'infer');
const paramInferPath = path.join(dirPath, 'paramInfer');
const needTrainPath = path.join(dirPath, 'needTrain');

if (!fs.existsSync(imagesPath)) fs.mkdirSync(imagesPath);
if (!fs.existsSync(imagesInfoPath)) fs.mkdirSync(imagesInfoPath);
if (!fs.existsSync(modelsPath)) fs.mkdirSync(modelsPath);
if (!fs.existsSync(paramModelsPath)) fs.mkdirSync(paramModelsPath);
if (!fs.existsSync(inferPath)) fs.mkdirSync(inferPath);
if (!fs.existsSync(paramInferPath)) fs.mkdirSync(paramInferPath);
if (!fs.existsSync(needTrainPath)) fs.mkdirSync(needTrainPath);

function getTar(vec) {
  let max = 0;
  let maxIdx = 0;
  for (let i = 0; i < vec.length;i++) {
    if (vec[i] > max) {
      max = vec[i];
      maxIdx =i ;
    }
  }
  classes = [
    'apple', 'aquarium_fish', 'baby', 'bear', 'beaver', 'bed', 'bee', 'beetle',
    'bicycle', 'bottle', 'bowl', 'boy', 'bridge', 'bus', 'butterfly', 'camel',
    'can', 'castle', 'caterpillar', 'cattle', 'chair', 'chimpanzee', 'clock',
    'cloud', 'cockroach', 'couch', 'crab', 'crocodile', 'cup', 'dinosaur',
    'dolphin', 'elephant', 'flatfish', 'forest', 'fox', 'girl', 'hamster',
    'house', 'kangaroo', 'keyboard', 'lamp', 'lawn_mower', 'leopard', 'lion',
    'lizard', 'lobster', 'man', 'maple_tree', 'motorcycle', 'mountain', 'mouse',
    'mushroom', 'oak_tree', 'orange', 'orchid', 'otter', 'palm_tree', 'pear',
    'pickup_truck', 'pine_tree', 'plain', 'plate', 'poppy', 'porcupine',
    'possum', 'rabbit', 'raccoon', 'ray', 'road', 'rocket', 'rose',
    'sea', 'seal', 'shark', 'shrew', 'skunk', 'skyscraper', 'snail', 'snake',
    'spider', 'squirrel', 'streetcar', 'sunflower', 'sweet_pepper', 'table',
    'tank', 'telephone', 'television', 'tiger', 'tractor', 'train', 'trout',
    'tulip', 'turtle', 'wardrobe', 'whale', 'willow_tree', 'wolf', 'woman',
    'worm'
  ]
  return classes[maxIdx];
}

function back(res, msg, others) {
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
      case 406:
        body.errmsg = '存在该模型名称，请重新命名';
        break;
      case 407:
        body.errmsg = '同名模型正在训练中，请稍后';
        break;
      case 4001:
        body.errmsg = '接口映射匹配失败';
        break;
      case 4002:
        body.errmsg = 'JSON格式有误，解析失败';
        break;
      default:
    }
  } else if (msg != undefined) {
    body.info = msg;
  }
  if (others) {
    body = {
      ...body,
      ...others
    }
  }
  res.json(body);
}
app.use(express.static('./'))
app.use(express.json({limit: '20mb'}));

app.delete('/image', (req, res) => {
  let {className, imageId} = req.query;
  let encodeClassName = encodeURIComponent(className);
  let imgPath = path.join(dirPath, 'images', encodeClassName, imageId);
  if (!fs.existsSync(imgPath)) {
    back(res, 404);
  } else {
    fs.unlinkSync(imgPath);
    back(res);
  }
})

app.get('/image', (req, res) => {
  let dir = fs.readdirSync('./images');
  let { className } = req.query;
  let resInfo = [];
  for (let i = 0; i < dir.length; i++) {
    let tar = {};
    let encodeClassName = dir[i];
    if (className && className !== decodeURIComponent(encodeClassName)) continue;
    tar.className = decodeURIComponent(encodeClassName);
    tar.images = fs.readdirSync('./images/' + encodeClassName);
    tar.createAt = Number(fs.statSync('./images/' + encodeClassName).ctime);
    resInfo.push(tar);
  }
  resInfo = resInfo.sort((a, b)=>{
    return b.createAt - a.createAt;
  })
  back(res, resInfo);
})

app.post('/image', (req, res) => {
  let { className } = req.query;
  // 参数校验
  if (!className) {
    return back(res, 400);
  }
  let encodeClassName = encodeURIComponent(className);
  let tarDirPath = path.join(dirPath, 'images', encodeClassName);
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
  if (!className) return back(res, 400);
  let encodeClassName = encodeURIComponent(className);
  let imagesDirPath = path.join(dirPath, 'images');
  if (!fs.existsSync(imagesDirPath)) {
    fs.mkdirSync(imagesDirPath);
  }
  let tarDirPath = path.join(imagesDirPath, encodeClassName);
  // 文件夹是否存在校验
  if (!fs.existsSync(tarDirPath)) {
    fs.mkdirSync(tarDirPath);
  }
  back(res)
})
app.delete('/class', (req, res) => {
  let { className } = req.query;
  // 参数校验
  if (!className) return back(res, 400);
  let encodeClassName = encodeURIComponent(className);
  let tarDirPath = path.join(dirPath, 'images', encodeClassName);
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
  let dirs = fs.readdirSync('./images');
  dirs = dirs.map((encodeClassName)=>{
    return {
      createAt: Number(fs.statSync(path.join(imagesPath, encodeClassName)).ctime),
      className: decodeURIComponent(encodeClassName)
    }
  })
  dirs = dirs.sort((a,b)=>{
    return b.createAt - a.createAt;
  })
  dirs = dirs.map((tar)=>{
    return tar.className;
  })
  back(res, dirs);
})
app.get('/imageInfo', (req, res) => {
  const { className, imgName } = req.query;
  if (!className || !imgName) return back(res, 400);
  const filePath = path.join(imagesInfoPath, `${className}_${imgName}.json`);
  if (!fs.existsSync(filePath)) return back(res, 404);
  const json = JSON.parse(fs.readFileSync(filePath).toString());
  back(res, json);
})
app.put('/imageInfo', (req, res) => {
  const { className, imgName } = req.query;
  const { imgInfo } = req.body;
  let filePath = path.join(imagesInfoPath, `${className}_${imgName}.json`);
  let needFetch = false; // 是否需要前端充值页面
  if (imgInfo.className && className !== imgInfo.className) {
    needFetch = true;
    // 转移图片
    const tarDirPath = path.join(imagesPath, encodeURIComponent(imgInfo.className));
    console.log(tarDirPath)
    if (!fs.existsSync(tarDirPath)) return back(res, 400);
    const newImgName = Date.now() + '_' + (fs.readdirSync(tarDirPath).length + 1);
    const newFileName = `${newImgName}.jpg`;
    const newFilePath = path.join(tarDirPath, newFileName);
    const oldFilePath = path.join(imagesPath, encodeURIComponent(className), `${imgName}`);
    fs.writeFileSync(newFilePath, fs.readFileSync(oldFilePath));
    fs.unlinkSync(oldFilePath);
    // 转移配置文件
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    filePath = path.join(imagesInfoPath, `${imgInfo.className}_${newImgName}.json`);
  }
  fs.writeFileSync(filePath, JSON.stringify(imgInfo));
  const json = JSON.parse(fs.readFileSync(filePath).toString());
  back(res, json, {needFetch});
})

app.post('/needTrain', async (req, res) => {
  let {classNames} = req.body;
  let {modelName,belong,modelType} = req.query;
  if (!classNames) return back(res, 400);
  if (!modelName) return back(res, 400);
  let modelFileName = `${modelName}.json`;
  if (fs.existsSync(path.join(needTrainPath, modelFileName))) return back(res, 406);
  fs.writeFileSync(path.join(needTrainPath, modelFileName), JSON.stringify({
    classNames,
    modelName,
    belong,
    modelType,
    createAt: Date.now()
  }))
  back(res);
})
app.get('/needTrain', async (req, res) => {
  let needTrains = fs.readdirSync(needTrainPath);
  let resInfo = []
  for (let i = 0; i < needTrains.length; i++) {
    let modelFileName = `${modelName}.json`;
    let fileInfo = JSON.parse(fs.readFileSync(path.join(needTrains, modelFileName)));
    resInfo.push(fileInfo)
  }
  back(res, resInfo);
})

app.post('/train', async (req, res) => {
  let {classNames} = req.body;
  let {modelName} = req.query;
  if (!classNames) return back(res, 400);
  if (!modelName) return back(res, 400);
  let classVecs = {};
  let modelFileName = modelName + '.json';
  let waitFileName = modelName + '.wait.json';
  if (fs.existsSync(path.join(dirPath, 'models', modelFileName))) return back(res, 406)
  if (fs.existsSync(path.join(dirPath, 'models', waitFileName))) return back(res, 407)
  // 计算工作量
  let cnt = 0;
  for (className of classNames) {
    let encodeClassName = encodeURIComponent(className);
    let imgs = fs.readdirSync(path.join(dirPath, 'images', encodeClassName));
    cnt += imgs.length;
  }
  let resInfo = {
    modelName,
    startTs: Date.now(),
    time: cnt*5,
    image: cnt,
    classes: classNames
  }
  fs.writeFileSync(path.join(dirPath, 'models', waitFileName), JSON.stringify(resInfo));
  back(res, resInfo);
  // 后台进入训练
  for (className of classNames) {
    let encodeClassName = encodeURIComponent(className);
    let imgs = fs.readdirSync(path.join(dirPath, 'images', encodeClassName));
    let imgVecs = {};
    for (let imgName of imgs) {
      let tarList = await getVec(`images/${encodeClassName}/${imgName}`);
      imgVecs[imgName] = tarList;
    }
    classVecs[className] = imgVecs;
  }
  fs.writeFileSync(path.join('./models/', modelFileName), JSON.stringify(classVecs));
  fs.unlinkSync(path.join('./models/', waitFileName));
})

app.get('/model', (req, res) => {
  let models = fs.readdirSync(modelsPath);
  let resInfo = [];
  for (let i = 0; i < models.length; i++) {
    let modelName = models[i];
    let modelPath = path.join(modelsPath, modelName);
    let createdAt = new Date(fs.statSync(modelPath).ctime).getTime();
    if (modelName.indexOf('.wait') > -1) {
      let info = JSON.parse(fs.readFileSync(modelPath));
      resInfo.push({
        name: modelName.replace('.wait.json', ''),
        eTs: info.startTs + info.time * 1000,
        status: (info.startTs + info.time * 1000) < Date.now() ? 'exception':'active',
        percent: parseInt((Date.now() - createdAt) / info.time / 1000 * 100),
        classes: info.classes,
        createdAt,
      })
    } else {
      let info = JSON.parse(fs.readFileSync(modelPath));
      resInfo.push({
        name: modelName.replace('.json', ''),
        classes: Object.keys(info),
        createdAt,
      })
    }
  }
  resInfo = resInfo.sort((a, b)=>{
    return b.createdAt - a.createdAt;
  })
  let paramModels = [];
  let paramModelsFiles = fs.readdirSync(paramModelsPath);
  for (let i = 0; i < paramModelsFiles.length; i++) {
    let fileName = paramModelsFiles[i];
    paramModels.push(JSON.parse(fs.readFileSync(path.join(paramModelsPath, fileName))));
  }
  back(res, resInfo, {paramModels});
})
app.delete('/model', (req, res) => {
  let { modelName } = req.query;
  // 参数校验
  if (!modelName) return back(res, 400);
  let tarPath = path.join(modelsPath, modelName + '.json');
  // 文件夹是否存在校验
  if (!fs.existsSync(tarPath)) return back(res, 404);
  fs.unlinkSync(tarPath);
  back(res);
})
app.get('/paramModel', (req, res) => {
  const {modelName} = req.query;
  if (modelName) {
    const filePath = path.join(paramModelsPath, `${modelName}.json`);
    console.log(filePath)
    if (!fs.existsSync(filePath)) return back(res, 404);
    return back(res, JSON.parse(fs.readFileSync(filePath).toString()));
  }
  let paramModels = [];
  let paramModelsFiles = fs.readdirSync(paramModelsPath);
  for (let i = 0; i < paramModelsFiles.length; i++) {
    let fileName = paramModelsFiles[i];
    paramModels.push(JSON.parse(fs.readFileSync(path.join(paramModelsPath, fileName))));
  }
  back(res, paramModels);
})
app.post('/paramModel', (req, res) => {
  let { modelName } = req.query;
  // 参数校验
  if (!modelName) return back(res, 400);
  let tarPath = path.join(paramModelsPath, modelName + '.json');
  // 文件夹是否存在校验
  if (fs.existsSync(tarPath)) return back(res, 406);
  req.body.createAt = Date.now();
  fs.writeFileSync(tarPath, JSON.stringify(req.body));
  back(res);
})
app.put('/paramModel', (req, res) => {
  let { modelName } = req.query;
  // 参数校验
  if (!modelName) return back(res, 400);
  let tarPath = path.join(paramModelsPath, modelName + '.json');
  // 文件夹是否存在校验
  if (!fs.existsSync(tarPath)) return back(res, 404);
  req.body.updateAt = Date.now();
  fs.writeFileSync(tarPath, JSON.stringify(req.body));
  back(res);
})
app.delete('/paramModel', (req, res) => {
  let { modelName } = req.query;
  // 参数校验
  if (!modelName) return back(res, 400);
  let tarPath = path.join(paramModelsPath, modelName + '.json');
  if (!fs.existsSync(tarPath)) return back(res, 404);
  fs.unlinkSync(tarPath)
  back(res);
})
app.post('/matchInfer', async (req, res) => {
  const { accRate, pixelRange } = req.query;
  const _accRate = accRate ? Number(accRate) : 0.8;
  const _pixelRange = pixelRange ? Number(pixelRange) : 60;
  const { base64s } = req.body;
  if (!base64s || !(base64s instanceof Array) || base64s.length < 2) return back(res, 400);
  const jimpImages = [];
  for (let i = 0; i < base64s.length; i++) {
    let imgName = `match_${Date.now()}_0${i+1}.jpg`;
    let filePath = path.join(paramInferPath, imgName);
    fs.writeFileSync(filePath, Buffer.from(base64s[i].replace(/^.*base64/,''), 'base64'));
    const image = await jimp.read(filePath);
    await image.resize(5,5);
    jimpImages[i] = image;
  }
  let img01Data = jimpImages[0].bitmap.data;
  let img02Data = jimpImages[1].bitmap.data;
  let sum = 1;
  let cnt = 1;
  console.log(img01Data, img01Data.length);
  for (let i = 0; i < img01Data.length; i++) {
    sum += 1;
    console.log(img01Data[i], img02Data[i])
    if (Math.abs(img01Data[i]-img02Data[i]) < _pixelRange) {
      cnt += 1;
    }
  }
  let matchRate = cnt / sum;
  console.log(matchRate)
  let isMatch = matchRate > _accRate ? true : false;
  back(res, isMatch);
})
app.post('/paramInfer', async (req, res) => {
  const { modelName } = req.query;
  const { base64s } = req.body;
  const jimpImages = [];
  for (let i = 0; i < base64s.length; i++) {
    let imgName = `${Date.now()}_0${i+1}.jpg`;
    let filePath = path.join(paramInferPath, imgName);
    fs.writeFileSync(filePath, Buffer.from(base64s[i].replace(/^.*base64/,''), 'base64'));
    const image = await jimp.read(filePath);
    await image.resize(5,5);
    jimpImages[i] = image;
  }
  
  const fileName = `${modelName}.json`;
  const filePath = path.join(paramModelsPath, fileName);
  if (!fs.existsSync(filePath)) return back(res, 404);
  const item = JSON.parse(fs.readFileSync(filePath));
  console.log(item);
  let tarJson = {};
  try {
    if (item.dataFormat) {
      tarJson = JSON.parse(item.dataFormat.replace('$text2', base64s[1]).replace('$text1', base64s[0]).replace('$text', base64s[0]));
    }
  } catch(err) {
    return back(res, 4002)
  }
  let headers = {}
  if (item.requestMethod === 'FORM') headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (item.requestMethod === 'JSON') headers['Content-Type'] = 'application/json';
  if (item.requestMethod === 'XML') headers['Content-Type'] = 'text/xml';
  let result = await axios({
    url: encodeURI(item.requestUrl),
    method: item.requestMethod === 'GET' ? 'GET': 'POST',
    headers,
    data: tarJson
  });
  let { data } = result;
  let finded = findTar(data, item.dataMap);
  console.log(data, finded);
  if (finded === undefined || finded instanceof Object) return back(res, 4001);
  back(res, finded);
})

function findTar(data, key) {
  if (data instanceof Array) {
    for (let i = 0; i < data.length; i++) {
      let finded = findTar(data[i]);
      if (finded !== undefined) {
        return finded;
      }
    }
  } else if (data instanceof Object) {
    for (let i in data) {
      if (key === i) {
        return data[i];
      }
    }
  }
  return;
}

app.post('/infer', async (req, res) => {
  let { modelName } = req.query;
  let { base64 } = req.body;
  if (!modelName) return back(res, 400); // 没发送模型名称
  if (!base64) return back(res, 400); // 没发送待推导图片
  let modelFileName = modelName + '.json';
  let modelFilePath = path.join(modelsPath, modelFileName);
  let isModelExist = fs.existsSync(modelFilePath);
  if (!isModelExist) return back(res, 404); // 不存在模型
  let model = JSON.parse(fs.readFileSync(modelFilePath));
  let inferFileName = Date.now() + '.jpg';
  let inferFilePath = path.join(inferPath, inferFileName);
  fs.writeFileSync(inferFilePath, Buffer.from(base64.replace(/^.*base64/,''), 'base64'));
  let inferVec = await getVec(`infer/${inferFileName}`);
  let modelInferDic = {};
  let mixList = [];
  for (let className in model) {
    let scores = [];
    let imgVecs = model[className];
    for (let imgName in imgVecs) {
      let imgVec = imgVecs[imgName];
      console.log(className, getTar(imgVec));
      let score = calScore(inferVec, imgVec);
      scores.push(score);
      mixList.push({
        imgName,
        className,
        score
      })
    }
    modelInferDic[className] = scores;
  }
  let maxScore = 0;
  for (let i = 0; i < mixList.length; i++) {
    let a = mixList[i];
    if (a.score > maxScore) maxScore = a.score;
  }
  mixList.sort((a,b)=>{
    return a.score - b.score;
  })
  console.log(mixList);
  // 这里是score从底到高，排序，所以这里的rankScore越高越好
  let finalRankScore = {};
  for (let i = 0; i < mixList.length; i++) {
    finalRankScore[mixList[i].className] = finalRankScore[mixList[i].className] || 0;
    finalRankScore[mixList[i].className] += mixList.length - i + mixList.length * (maxScore-mixList[i].score);
    if (mixList[i].score < 0.1) {
      finalRankScore[mixList[i].className] += mixList.length * 5;
    }
  }
  console.log(finalRankScore);
  let sumRankScore = 0;
  for (let className in model) {
    finalRankScore[className] = finalRankScore[className] || 0;
    finalRankScore[className] /= (Object.keys(model[className]).length + 1);
    sumRankScore += finalRankScore[className];
  }
  console.log(sumRankScore)
  let maxRankScore = 0;
  let result = '';
  for (let className in model) {
    finalRankScore[className] /= sumRankScore;
    if (finalRankScore[className] > maxRankScore) {
      maxRankScore = finalRankScore[className];
      result = className;
    }
  }

  back(res, finalRankScore, {result});
})

/**
 * 计算分数，这里的数值越小代表越接近，所以越小越好
 * @param {*} tarVec 
 * @param {*} modelVec 
 */
function calScore(tarVec, modelVec) {
  let score = 0;
  for (let i = 0; i < tarVec.length; i++) {
    score += (tarVec[i] - modelVec[i]) ** 2;
  }
  return score;
}

app.listen(port)

console.log('Host listen at', port);