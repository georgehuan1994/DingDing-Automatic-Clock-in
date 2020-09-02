# DingDing-Automatic-Clock-in
## 简介
钉钉自动打卡脚本，基于AutoJs，免Root

## 功能
1. 定时自动打卡
2. 远程指令打卡
3. 发送打卡结果

## 设备及工具
1. AutoJs (4.1.1a Alpha2-armeabi-v7a-release)
2. Tasker
3. 网易邮箱大师

## 原理
在AutoJs脚本中监听本机通知，并在tasker中创建定时任务发出打卡通知，或在另一设备上发送消息到本机，即可触发脚本中的打卡进程，以实现定时打卡和远程打卡的功能

在使用前，需要对脚本做一些调整，来适配你的设备

## AutoJs
AutoJs是安卓平台上的JavaScript自动化工具 https://github.com/hyb1996/Auto.js

官方文档已失效，第三方文档：https://www.easydoc.xyz/doc/25791054/uw2FUUiw/3bEzXb4y

## 使用说明
- 安装AutoJs
- 在使用前，需要对脚本做一些调整，来适配你的设备。使用VSCode配合AutoJs插件来修改和调试脚本

## 更新日志
2020-09-02：钉钉工作台界面改版（新增考勤打卡的快捷入口）。无法通过“考勤打卡”相关属性获取控件，改为使用“去打卡”文本获取按钮。若找不到“去打卡”按钮，则直接点击“考勤打卡”的屏幕坐标（需根据手机分辨率修改）
