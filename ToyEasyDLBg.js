const express = require('express');
const { getVec } = require('./callPy.js');
const fs = require('fs');
const path = require('path');
const { dir } = require('console');
const app = new express();
const port = 8000;
const dirPath = './';
const imagesPath = path.join(dirPath, 'images');
const modelsPath = path.join(dirPath, 'models');
const inferPath = path.join(dirPath, 'infer');

if (!fs.existsSync(imagesPath)) fs.mkdirSync(imagesPath);
if (!fs.existsSync(modelsPath)) fs.mkdirSync(modelsPath);
if (!fs.existsSync(inferPath)) fs.mkdirSync(inferPath);

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
      case 406:
        body.errmsg = '存在该模型名称，请重新命名';
        break;
      case 407:
        body.errmsg = '同名模型正在训练中，请稍后';
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
  let resInfo = [];
  for (let i = 0; i < dir.length; i++) {
    let tar = {};
    let className = dir[i];
    tar.className = className;
    tar.images = fs.readdirSync('./images/' + className);
    resInfo.push(tar);
  }
  back(res, resInfo);
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
  let imagesDirPath = path.join(dirPath, 'images');
  if (!fs.existsSync(imagesDirPath)) {
    fs.mkdirSync(imagesDirPath);
  }
  let tarDirPath = path.join(imagesDirPath, className);
  // 文件夹是否存在校验
  if (!fs.existsSync(tarDirPath)) {
    fs.mkdirSync(tarDirPath);
  }
  back(res)
})
app.del('/class', (req, res) => {
  let { className } = req.query;
  // 参数校验
  if (!className) return back(res, 400);
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
    let imgs = fs.readdirSync(path.join(dirPath, 'images', className));
    cnt += imgs.length;
  }
  let resInfo = {
    modelName,
    startTs: Date.now(),
    time: cnt*6,
    image: cnt,
    classes: classNames
  }
  fs.writeFileSync(path.join(dirPath, 'models', waitFileName), JSON.stringify(resInfo));
  back(res, resInfo);
  // 后台进入训练
  for (className of classNames) {
    let imgs = fs.readdirSync(path.join(dirPath, 'images', className));
    let imgVecs = {};
    for (let imgName of imgs) {
      let tarList = await getVec(`images/${className}/${imgName}`);
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
    if (modelName.indexOf('.wait') > -1) {
      let info = JSON.parse(fs.readFileSync(path.join(modelsPath, modelName)));
      resInfo.push({
        name: modelName.replace('.wait.json', ''),
        eTs: info.startTs + info.time * 1000,
        classes: info.classes
      })
    } else {
      let info = JSON.parse(fs.readFileSync(path.join(modelsPath, modelName)));
      resInfo.push({
        name: modelName.replace('.json', ''),
        classes: Object.keys(info)
      })
    }
  }
  back(res, resInfo);
})

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
  mixList.sort((a,b)=>{
    if (a.score > maxScore) maxScore = a.score;
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
  for (let className in model) {
    finalRankScore[className] /= sumRankScore;
  }

  back(res, finalRankScore);
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