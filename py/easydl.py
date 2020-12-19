import sys
import torch
import torch.nn as nn
import torch.optim as optim
import torchvision
import torchvision.transforms as transforms
import argparse
from resnet import ResNet18
# 定义是否使用GPU
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

parser = argparse.ArgumentParser(description='PyTorch CIFAR10 Training')
parser.add_argument('--outf', default='./model/', help='folder to output images and model checkpoints') #输出结果保存路径
parser.add_argument('--net', default='./model/Resnet18.pth', help="path to net (to continue training)")  #恢复训练时的模型路径
parser.add_argument('--test', default='./test/apple.jpg', help="test img path")  #恢复训练时的模型路径
args = parser.parse_args()

transform_test = transforms.Compose([
    transforms.ToTensor()
])


net = ResNet18().to(device)
import cv2
import matplotlib.pyplot as plt
img_cv = cv2.imread(args.test)            # cv2.imread()------np.array, (H x W xC), [0, 255], BGR
img_cv = cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB)
dim = (32, 32)
img_cv = cv2.resize(img_cv, dim)
tensor_cv = torch.from_numpy(img_cv)
plt.imshow(img_cv)

checkpoint = torch.load(sys.path[0] + '/model/net_025.pth')
net.load_state_dict(checkpoint)

with torch.no_grad():
    images = torch.tensor([transform_test(img_cv).tolist()])
    images = images.to(device)
    outputs = net(images)
    net.eval()
    plt.imshow(images[0].cpu().numpy().transpose(1,2,0))
    _, pre = torch.max(outputs.data, 1)
    print(outputs.data.tolist()[0])