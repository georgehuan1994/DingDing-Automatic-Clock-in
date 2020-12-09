# DingDing-Automatic-Clock-in

<img width="270" height="585" src="https://github.com/georgehuan1994/DingDing-Automatic-Clock-in/blob/master/图片/Screenshot_2020-10-29-19-29-35-361_org.autojs.autojs.jpg"/>  <img width="270" height="585" src="https://github.com/georgehuan1994/DingDing-Automatic-Clock-in/blob/master/图片/Screenshot_20201029193358.png"/>

## 简介
钉钉自动打卡、远程打卡脚本，基于AutoJs，免Root

## 功能
- 定时自动打卡
- 远程指令打卡
- 发送打卡结果

## 工具
- AutoJs
- Tasker
- 网易邮箱大师

## 原理
在AutoJs脚本中监听本机通知，并在Tasker中创建定时任务发出打卡通知，或在另一设备上发送消息到本机，即可触发脚本中的打卡流程，实现定时打卡和远程打卡。

## 脚本
```javascript
/*
 * @Author: George Huan
 * @Date: 2020-08-03 09:30:30
 * @LastEditTime: 2020-12-04 11:44:38
 * @Description: DingDing-Automatic-Clock-in (Run on AutoJs)
 */

const ACCOUNT = "钉钉账号"
const PASSWORD = "钉钉密码"
const EMAILL_ADDRESS = "用于接收打卡结果的邮箱地址"

const BUNDLE_ID_DD = "com.alibaba.android.rimet"
const BUNDLE_ID_XMSF = "com.xiaomi.xmsf"
const BUNDLE_ID_MAIL = "com.netease.mail"
const BUNDLE_ID_TASKER = "net.dinglisch.android.taskerm"

const NAME_OF_EMAILL_APP = "网易邮箱大师"
const NAME_OF_ATTENDANCE_MACHINE = "前台大门" // 考勤机名称

const LOWER_BOUND = 1 * 60 * 1000 // 最小等待时间：1min
const UPPER_BOUND = 5 * 60 * 1000 // 最大等待时间：5min

// Home键坐标y，用于快捷手势：长按Home键锁屏
const BUTTON_HOME_POS_X = 540
const BUTTON_HOME_POS_Y = 2278

// 打卡按钮坐标，因上班打卡按钮有可能获取不到，故使用打卡按钮坐标作为保险操作
const BUTTON_DAKA_X = 540    
const BUTTON_DAKA_Y = 1325

// 执行时的屏幕亮度（0-255）
const SCREEN_BRIGHTNESS = 20    

// 是否过滤通知
const NOTIFICATIONS_FILTER = false; 

// BundleId过滤列表
var bundleIdAllowList = [BUNDLE_ID_DD,BUNDLE_ID_XMSF,BUNDLE_ID_MAIL,BUNDLE_ID_TASKER, ]

var weekday = new Array(7);
weekday[0] = "Sunday"
weekday[1] = "Monday"
weekday[2] = "Tuesday"
weekday[3] = "Wednesday"
weekday[4] = "Thursday"
weekday[5] = "Friday"
weekday[6] = "Saturday"

var message = ""
var needWaiting = true
var currentDate = new Date()


// ===================== 主线程：监听并处理通知 ======================

// 检查无障碍权限启动
auto.waitFor("normal")          

// 创建运行日志
console.setGlobalLogConfig({
    file: "/sdcard/脚本/Archive/" + getCurrentDate() + "-log.txt"
});

// 自动放缩坐标以适配其他设备
setScreenMetrics(1080, 2340)    

// 监听本机通知
events.observeNotification()    
events.onNotification(function(notification) {
    notificationHandler(notification)
});

toastLog("监听中，请在日志中查看记录的通知及其内容")

// ===================== 主线程：监听并处理通知 =======================



/**
 * @description 处理通知
 */
function notificationHandler(notification) {
    
    var bundleId = notification.getPackageName()    // 获取通知包名
    var abstract = notification.tickerText          // 获取通知摘要
    var text = notification.getText()               // 获取通知文本

    // 筛选通知
    if (!filterNotification(bundleId, abstract, text)) { 
        return;
    }

    // 监听摘要为 "定时打卡" 的通知
    if (abstract == "定时打卡") { 
        needWaiting = true
        threads.start(function(){
            doClock()
        })
        return;
    }
    
    // 监听文本为 "打卡" 的通知
    if ((bundleId == BUNDLE_ID_MAIL || bundleId == BUNDLE_ID_XMSF) && text == "打卡") { 
        needWaiting = false
        threads.start(function(){
            doClock()
        })
        return;
    }
    
    // 监听文本为 "打卡结果" 的通知
    if ((bundleId == BUNDLE_ID_MAIL || bundleId == BUNDLE_ID_XMSF) && text == "打卡结果") { 
        threads.shutDownAll()
        message = getStorageData("dingding", "clockResult")
        console.warn(message)
        sendEmail()
        return;
    }

    if (text == null) {
        return;
    }
    
    // 监听钉钉返回的考勤结果
    if (bundleId == BUNDLE_ID_DD && text.indexOf("考勤打卡") >= 0) { 
        threads.shutDownAll()
        message = text
        console.warn(message)
        setStorageData("dingding", "clockResult", text)
        sendEmail()
        return;
    }
}


/**
 * @description 打卡主程序 
 */
function doClock() {
    
    console.show()              // 显示控制台
    sleep(100)                  // 等待控制台出现
    console.setSize(800,450)    // 调整控制台尺寸

    currentDate = new Date()
    console.info("当前：" + getCurrentDate() + " " + getCurrentTime())
    console.log("开始执行打卡主程序")

    brightScreen()      // 唤醒屏幕
    unlockScreen()      // 解锁屏幕
    stopApp()           // 结束钉钉
    holdOn()            // 随机等待
    signIn()            // 自动登录
    handleUpdata()      // 处理更新
    handleLate()        // 处理迟到
    enterGongzuo()      // 进入工作台
    enterKaoqin()       // 进入打卡界面

    if (currentDate.getHours() <= 12) {
        clockIn()       // 上班打卡
    }
    else {
        clockOut()      // 下班打卡
    }
    lockScreen()        // 关闭屏幕
    console.hide()      // 关闭控制台
}


/**
 * @description 发邮件主程序
 */
function sendEmail() {

    console.info("开始执行邮件发送主程序")

    brightScreen()  // 唤醒屏幕
    unlockScreen()  // 解锁屏幕

    console.info("正在发送邮件")
    app.sendEmail({
        email: [EMAILL_ADDRESS],
        subject: "考勤结果",
        text: message
    })
    
    waitForActivity("com.android.internal.app.ChooserActivity")
    if (null != textMatches(NAME_OF_EMAILL_APP).findOne(3000)) {
        btn_email = textMatches(NAME_OF_EMAILL_APP).findOnce().parent()
        btn_email.click()
    }
    else {
        console.log("没有找到" + NAME_OF_EMAILL_APP)
        lockScreen()
        return;
    }

    waitForActivity("com.netease.mobimail.activity.MailComposeActivity")
    id("send").findOne().click()

    console.log("已发送")
    message = ""
    
    home()
    sleep(1000)
    lockScreen()    // 关闭屏幕
}


/**
 * @description 唤醒设备
 */
function brightScreen() {

    console.info("唤醒设备")
    
    device.setBrightnessMode(0) // 手动亮度模式
    device.setBrightness(SCREEN_BRIGHTNESS)
    device.wakeUpIfNeeded() // 唤醒设备
    device.keepScreenOn()   // 保持亮屏

    console.log("已唤醒")
    
    sleep(1000) // 等待屏幕亮起
    if (!device.isScreenOn()) {
        console.warn("设备未唤醒")
        device.wakeUpIfNeeded()
        brightScreen()
    }
    sleep(1000)
}


/**
 * @description 解锁屏幕
 */
function unlockScreen() {

    console.info("解锁屏幕")
    
    gesture(320,[540,device.height * 0.9],[540,device.height * 0.1]) // 上滑解锁
    sleep(1000) // 等待解锁动画完成
    home()
    sleep(1000) // 等待返回动画完成
    
    console.log("已解锁")
}


/**
 * @description 结束钉钉进程
 */
function stopApp() {

    console.info("结束钉钉进程")

    // Root
    // shell('am force-stop ' + BUNDLE_ID_DD, true) 

    // No Root
    app.openAppSetting(BUNDLE_ID_DD)
    let btn_finish = textMatches(/(.*结束.*)|(.*停止.*)|(.*运行.*)/).clickable(true).findOne() // 找到 "结束运行" 按钮，并点击
    if (btn_finish.enabled()) {
        btn_finish.click()

        btn_sure = textMatches("确定").clickable(true).findOne()
        btn_sure.click() // 找到 "确定" 按钮，并点击

        console.log(app.getAppName(BUNDLE_ID_DD) + "已被关闭")
        sleep(1000)
        home()
    } else {
        console.log(app.getAppName(BUNDLE_ID_DD) + "未在运行")
        sleep(1000)
        home()
    }
    sleep(1000)
}


/**
 * @description 随机等待
 */
function holdOn(){

    if (!needWaiting) {
        return;
    }

    var randomTime = random(LOWER_BOUND, UPPER_BOUND)
    toastLog(Math.floor(randomTime / 1000) + "秒后启动" + app.getAppName(BUNDLE_ID_DD) + "...")
    sleep(randomTime)
}


/**
 * @description 启动并登陆钉钉
 */
function signIn() {

    app.launchPackage(BUNDLE_ID_DD)
    console.info("正在启动" + app.getAppName(BUNDLE_ID_DD) + "...")
    
    sleep(10000)    // 等待钉钉启动
    handleUpdata()  // 处理更新弹窗

    if (id("et_pwd_login").exists()) {
        console.log("账号未登录")

        var account = id("et_phone_input").findOne()
        account.setText(ACCOUNT)
        console.log("输入账号")

        var password = id("et_pwd_login").findOne()
        password.setText(PASSWORD)
        console.log("输入密码")
        
        var btn_login = id("btn_next").findOne()
        btn_login.click()
        console.log("正在登陆")
    }
    else {
        if (id("menu_tel").exists()) {
            console.log("账号已登录，当前位于活动页面")
            sleep(1000)
        } 
        else {
            console.warn("未检测到活动页面，重试")
            signIn()
        }
    }
}


/**
 * @description 处理钉钉更新弹窗
 */
function handleUpdata(){

    if (null != textMatches("暂不更新").clickable(true).findOne(3000)) {
        console.info("发现更新弹窗")

        btn_dontUpdate = textMatches(/(.*暂不更新.*)/).findOnce()
        btn_dontUpdate.click()

        console.log("暂不更新")
        sleep(1000)
    }
}


/**
 * @description 处理迟到打卡
 */
function handleLate(){

    if (null != descMatches("迟到打卡").clickable(true).findOne(1000)) {
        console.log("descMatches：迟到打卡")

        btn_late = descMatches(/(.*迟到打卡.*)/).clickable(true).findOnce() 
        btn_late.click()
    }
    
    if (null != textMatches("迟到打卡").clickable(true).findOne(1000)) {
        console.log("textMatches：迟到打卡")

        btn_late = textMatches(/(.*迟到打卡.*)/).clickable(true).findOnce() 
        btn_late.click()
    }
}


/**
 * @description 进入工作台
 */
function enterGongzuo(){
    
    if (null != descMatches("工作台").clickable(true).findOne(3000)) {
        toastLog("descMatches：工作台")

        btn_gongzou = descMatches(/(.*工作台.*)/).findOnce()
        btn_gongzou.click()
    }

    console.info("正在进入工作台...")
    sleep(5000)
    
    if (id("menu_work_info").exists()) {
        console.log("已进入工作台页面")
        sleep(1000)
    }
}


/**
 * @description 进入打卡界面
 */
function enterKaoqin(){

    if (null != textMatches("去打卡").clickable(true).findOne(3000)) {
        console.log("textMatches：去打卡")

        btn_kaoqin = textMatches(/(.*去打卡.*)/).clickable(true).findOnce() 
        btn_kaoqin.click()
    }
    else {
        attendKaoqin()
    }

    console.info("正在进入考勤打卡页面...")
    sleep(6000)
    
    if (null != textMatches("申请").clickable(true).findOne(3000)) {
        console.log("已进入考勤打卡页面")
        sleep(1000)
    }
}


/**
 * @description 使用Intent拉起考勤打卡界面
 */
function attendKaoqin(){
    var a = app.intent({
        action: "VIEW",
        data: "dingtalk://dingtalkclient/page/link?url=https://attend.dingtalk.com/attend/index.html"
      });
      app.startActivity(a);
}


/**
 * @description 上班打卡 
 */
function clockIn() {

    console.info("上班打卡...")
    
    if (null != textContains("已打卡").findOne(1000)) {
        toastLog("已打卡")
        home()
        sleep(1000)
        return;
    }

    console.log("等待连接到考勤机...")
    textContains(NAME_OF_ATTENDANCE_MACHINE).waitFor()
    
    console.log("已连接")
    sleep(1000)

    if (null != textMatches("上班打卡").findOne(1000)) {
        // textMatches(/(.*上班打卡.*)/).findOnce().parent().parent().click()
        // textMatches(/(.*上班打卡.*)/).findOnce().parent().click()
        textMatches(/(.*上班打卡.*)/).findOnce().click()
        console.log("textMatches：上班打卡")
        sleep(1000)
    }

    if (null != descMatches("上班打卡").findOne(1000)) {
        // descMatches(/(.*上班打卡.*)/).findOnce().parent().parent().click()
        // descMatches(/(.*上班打卡.*)/).findOnce().parent().click()
        descMatches(/(.*上班打卡.*)/).findOnce().click()
        console.log("descMatches：上班打卡")
        sleep(1000)
    }

    click(BUTTON_DAKA_X,BUTTON_DAKA_Y)
    sleep(200)
    click(BUTTON_DAKA_X,BUTTON_DAKA_Y)
    sleep(200)
    click(BUTTON_DAKA_X,BUTTON_DAKA_Y)
    console.log("按下打卡按钮")
    sleep(1000)

    handleLate() // 迟到打卡
    
    if (null != textContains("上班打卡成功").findOne(3000)) {
        toastLog("上班打卡成功")
    }

    home()
    sleep(1000)
}


/**
 * @description 下班打卡 
 */
function clockOut() {

    console.info("下班打卡...")

    if (null != textContains("更新打卡").findOne(1000)) {
        toastLog("已打卡")
        if (null != textContains("早退").findOne(1000)) {
            toastLog("早退")
        }
        else {
            home()
            sleep(1000)
            return;
        }
        console.log("更新打卡记录")
    }

    console.log("等待连接到考勤机...")
    textContains(NAME_OF_ATTENDANCE_MACHINE).waitFor()
    
    console.log("已连接")
    sleep(1000)

    if (null != textMatches("下班打卡").clickable(true).findOne(1000)) {
        textMatches(/(.*下班打卡.*)/).findOnce().click()
        console.log("按下打卡按钮")
        sleep(1000)
    }

    if (null != textContains("早退打卡").clickable(true).findOne(1000)) {
        className("android.widget.Button").text("早退打卡").findOnce().parent().click()
        console.log("早退打卡")
    }
    
    if (null != textContains("下班打卡成功").findOne(3000)) {
        toastLog("下班打卡成功")
    }

    home()
    sleep(1000)
}


/**
 * @description 锁屏
 */
function lockScreen(){

    console.log("关闭屏幕")

    device.setBrightnessMode(1) // 自动亮度模式
    device.cancelKeepingAwake() // 取消设备常亮
    
    // Root
    // Power()

    // No Root
    press(BUTTON_HOME_POS_X, BUTTON_HOME_POS_Y, 1000) // 小米的快捷手势：长按Home键锁屏
}



// ===================== 功能函数 =======================

function dateDigitToString(num){
    return num < 10 ? '0' + num : num
}

function getCurrentTime(){
    currentDate = new Date()
    var hours = dateDigitToString(currentDate.getHours())
    var minute = dateDigitToString(currentDate.getMinutes())
    var second = dateDigitToString(currentDate.getSeconds())
    var formattedTimeString = hours + ':' + minute + ':' + second
    return formattedTimeString
}

function getCurrentDate(){
    currentDate = new Date()
    var year = dateDigitToString(currentDate.getFullYear())
    var month = dateDigitToString(currentDate.getMonth() + 1) // Date.getMonth()的返回值是0-11,所以要+1
    var date = dateDigitToString(currentDate.getDate())
    var week = currentDate.getDay()
    var formattedDateString = year + '-' + month + '-' + date + '-' + weekday[week]
    return formattedDateString
}

// 通知过滤器
function filterNotification(bundleId, abstract, text) {
    
    if (!NOTIFICATIONS_FILTER) {
        console.verbose(bundleId)
        console.verbose(abstract)
        console.verbose(text)  
        console.verbose("---------------------------")
        return true
    }
    bundleIdAllowList.every(function(item) {
        var result = bundleId == item
        return result
    });
    if (result) {
        console.verbose(bundleId)
        console.verbose(abstract)
        console.verbose(text)  
        console.verbose("---------------------------")
    }
    return result
}

// 保存本地数据
function setStorageData(name, key, value) {
    const storage = storages.create(name)  // 创建storage对象
    storage.put(key, value)
}

// 读取本地数据
function getStorageData(name, key) {
    const storage = storages.create(name)
    if (storage.contains(key)) {
        return storage.get(key, "")
    }
    // 默认返回undefined
}

// 删除本地数据
function delStorageData(name, key) {
    const storage = storages.create(name)
    if (storage.contains(key)) {
        storage.remove(key)
    }
}
```

## 使用方法
### AutoJs
下载：[Auto.js 4.1.1a Alpha2-armeabi-v7a-release](https://www.lanzous.com/i56aexi "Auto.js 4.1.1a Alpha2-armeabi-v7a-release")

AutoJs是安卓平台上的JavaScript自动化工具 https://github.com/hyb1996/Auto.js

官方文档已失效，第三方文档：https://www.easydoc.xyz/doc/25791054/uw2FUUiw/3bEzXb4y

PC和手机连接到同一网络，使用 VSCode + Auto.js插件（在扩展中心搜索 "hyb1996"） 可方便的调试并将脚本保存到手机上

### Tasker
<img width="270" height="585" src="https://github.com/georgehuan1994/DingDing-Automatic-Clock-in/blob/master/图片/截图_004.jpg"/>

1. 添加一个 "通知" 操作任务，通知标题修改为 "定时打卡"，通知文字随意，通知优先级设为 1

2. 添加两个配置文件，使用日期和时间作为条件，分别在上班前和下班后触发

或者[下载任务和配置文件](https://github.com/georgehuan1994/DingDing-Automatic-Clock-in/tree/master/Tasker配置 "下载配置")，导入到Tasker中使用

### 远程打卡
回复标题为 "打卡" 的邮件，即可触发打卡进程

回复标题为 "打卡结果" 的邮件，即可查询最新一次打卡结果

### 注意事项
1. 此脚本会自动适配不同分辨率的设备，但AutoJs对平板的兼容性不佳，不推荐在平板设备上使用

2. 首次启动AutoJs时，需要为其开启无障碍权限

3. 为保证AutoJs、Tasker进程不被系统清理，可调整它们的电池管理策略、加入管理应用的白名单，为其开启前台服务、添加应用锁

4. 虽然脚本可执行完整的打卡步骤，但仍推荐开启钉钉的极速打卡功能，在钉钉启动时即可完成打卡，应把后续的步骤视为极速打卡失败后的保险措施

## 更新日志
### 2020-12-04

优化：打卡过程在子线程中执行，钉钉返回打卡结果后，直接中断子线程，减少无效操作

### 2020-10-27

修复：当钉钉的通知文本为null时，indexOf()方法无法正常执行

### 2020-09-24

优化：若无法进入考勤打卡界面，则使用intent直接拉起考勤打卡界面

```javascript
function attendKaoqin(){
    var a = app.intent({
        action: "VIEW",
        data: "dingtalk://dingtalkclient/page/link?url=https://attend.dingtalk.com/attend/index.html" // 在后面加上 ?CorpId=************
      });
      app.startActivity(a);
      sleep(5000)
}
```

获取URL的方式：

1. 在PC端找到 “智能工作助理” 联系人

2. 发送消息 “打卡” ，点击 “立即打卡” 

3. 弹出一个二维码。此二维码就是拉起考勤打卡界面的 URL Scheme ，用自带的相机或其他应用扫描，并在浏览器中打开，即可获得完整URL Scheme

4. 无需使用完整URL，将`?CorpId=***` 拼接到 `dingtalk://dingtalkclient/page/link?url=https://attend.dingtalk.com/attend/index.html` 之后即可

5. 仅使用 `dingtalk://dingtalkclient/page/link?url=https://attend.dingtalk.com/attend/index.html`，也可以拉起旧版打卡界面，钉钉会自动获取CorpId，并跳转到新版打卡界面

### 2020-09-11

- 将上次考勤结果储存在本地

- 将运行日志储存在本地 /sdcard/脚本/Archive/

- 修复在下班极速打卡之后，重复打卡的问题

### 2020-09-04

将 "打卡" 与 "发送邮件" 分离成两个过程，打卡完成后，将钉钉返回的考勤结果作为邮件正文发送

### 2020-09-02

钉钉工作台界面改版（新增考勤打卡的快捷入口）。无法通过 "考勤打卡" 相关属性获取控件，改为使用 "去打卡" 文本获取按钮。若找不到 "去打卡" 按钮，则直接点击 "考勤打卡" 的屏幕坐标
