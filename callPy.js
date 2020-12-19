const exec = require('child_process').exec;

function getVec(imgPath) {
  return new Promise((resolve, reject) => {
    console.log(`推导：./${imgPath}`)
    const cmdStr = `py ./py/easydl.py --test ./${imgPath}`;
    exec(cmdStr, function (err, stdout, stderr) {
      if (err) {
        reject(stderr);
      } else {
        const data = JSON.parse(stdout);
        resolve(data);
      }
    });
  })
}

module.exports = {
  getVec
}

