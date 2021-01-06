const exec = require('child_process').exec;

function getVec(imgPath) {
  return new Promise((resolve, reject) => {
    const cmdStr = `py ./py/easydl.py --test ./${imgPath}`;
    console.log(`推导：${cmdStr}`);
    exec(cmdStr, function (err, stdout, stderr) {
      if (err) {
        console.log(err);
        reject(stderr);
      } else {
        const data = JSON.parse(stdout);
        resolve(data);
      }
    });
  })
}

function faceDetect(imgPath) {
  return new Promise((resolve, reject) => {
    const cmdStr = `py ./py/slashFace.py --test ./${imgPath} --method detect`;
    console.log(`推导：${cmdStr}`);
    exec(cmdStr, function (err, stdout, stderr) {
      if (err) {
        console.log(err);
        reject(stderr);
      } else {
        const data = JSON.parse(stdout);
        resolve(data);
      }
    });
  })
}
function faceDistance(imgPaths) {
  return new Promise((resolve, reject) => {
    const cmdStr = `py ./py/slashFace.py --test ./${imgPaths.join(',')} --method distance`;
    console.log(`推导：${cmdStr}`);
    exec(cmdStr, function (err, stdout, stderr) {
      if (err) {
        console.log(err);
        reject(stderr);
      } else {
        const data = JSON.parse(stdout);
        resolve(data);
      }
    });
  })
}

module.exports = {
  getVec,
  faceDetect,
  faceDistance
}

