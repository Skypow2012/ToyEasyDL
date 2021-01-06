# 人脸特征点提取
import dlib
from imageio import imread
import glob
import numpy as np
import argparse
import json
import sys

parser = argparse.ArgumentParser(description='PyTorch CIFAR10 Training')
parser.add_argument('--test', default='./test/f1.jpg', help="test img path")  #恢复训练时的模型路径
parser.add_argument('--method', default='detect', help="method [detect|distance]")  #恢复训练时的模型路径
args = parser.parse_args()

detector = dlib.get_frontal_face_detector()
predictor_path = sys.path[0] + '/model/slashFace/shape_predictor_68_face_landmarks.dat'
predictor = dlib.shape_predictor(predictor_path)
face_rec_model_path = sys.path[0] + '/model/slashFace/dlib_face_recognition_resnet_model_v1.dat'
facerec = dlib.face_recognition_model_v1(face_rec_model_path)
 
def detect(path):
  img = imread(path)
  dets = detector(img)
  return dets
 
def get_feature(path):
    img = imread(path)
    dets = detector(img)
    # print('检测到了 %d 个人脸' % len(dets))
    # 这里假设每张图只有一个人脸
    if not dets[0]:
      return False
    shape = predictor(img, dets[0])
    face_vector = facerec.compute_face_descriptor(img, shape)
    return(face_vector)
 
def distance(a,b):
    a,b = np.array(a), np.array(b)
    sub = np.sum((a-b)**2)
    add = (np.sum(a**2)+np.sum(b**2))/2.
    return sub/add

if args.method == 'detect':
  path = args.test # "f1.jpg"
  dets = detect(path)
  # print(json.dumps(dets))
  result = []
  for i, d in enumerate(dets):
    result.append([d.top(), d.right(), d.bottom(), d.left()])
  print(json.dumps(result))
  # print('检测到了 %d 个人脸' % len(dets))
  # for i, d in enumerate(dets):
  #     print('- %d：Left %d Top %d Right %d Bottom %d' % (i, d.left(), d.top(), d.right(), d.bottom()))
elif args.method == 'distance':
  path_lists = args.test.split(',') # ["f1.jpg","f2.jpg"]
  feature_lists = [get_feature(path) for path in path_lists]
  if len(feature_lists) < 2 or not feature_lists[0] or not feature_lists[1]:
    print(0)
  else:
    out = distance(feature_lists[0],feature_lists[1])
    print(out)
