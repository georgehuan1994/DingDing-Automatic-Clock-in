/*
 * @Author: George Huan
 * @Date: 2020-08-03 09:30:30
 * @LastEditTime: 2022-03-26 10:56:25
 * @Description: DingDing-Automatic-Clock-in (Run on AutoJs)
 * @URL: https://github.com/georgehuan1994/DingDing-Automatic-Clock-in
 */

const ACCOUNT = "钉钉账号"
const PASSWORD = "钉钉密码"

const QQ =              "用于接收打卡结果的QQ号"
const EMAILL_ADDRESS =  "用于接收打卡结果的邮箱地址"
const SERVER_CHAN =     "Server酱发送密钥"
const PUSH_DEER =       "PushDeer发送密钥"

const PUSH_METHOD = {QQ: 1, Email: 2, ServerChan: 3, PushDeer: 4}

// 默认通信方式：
// PUSH_METHOD.QQ -- QQ
// PUSH_METHOD.Email -- Email 
// PUSH_METHOD.ServerChan -- Server酱
// PUSH_METHOD.PushDeer -- Push Deer
var DEFAULT_MESSAGE_DELIVER = PUSH_METHOD.QQ;

const PACKAGE_ID_QQ = "com.tencent.mobileqq"                // QQ
const PACKAGE_ID_DD = "com.alibaba.android.rimet"           // 钉钉
const PACKAGE_ID_XMSF = "com.xiaomi.xmsf"                   // 小米推送服务
const PACKAGE_ID_TASKER = "net.dinglisch.android.taskerm"   // Tasker
const PACKAGE_ID_MAIL_163 = "com.netease.mail"              // 网易邮箱大师
const PACKAGE_ID_MAIL_ANDROID = "com.android.email"         // 系统内置邮箱
const PACKAGE_ID_PUSHDEER = "com.pushdeer.os"               // Push Deer

const LOWER_BOUND = 1 * 60 * 1000 // 最小等待时间：1min
const UPPER_BOUND = 5 * 60 * 1000 // 最大等待时间：5min

// 执行时的屏幕亮度（0-255）, 需要"修改系统设置"权限
const SCREEN_BRIGHTNESS = 20    

// 是否过滤通知
const NOTIFICATIONS_FILTER = true

// PackageId白名单
const PACKAGE_ID_WHITE_LIST = [PACKAGE_ID_QQ,PACKAGE_ID_DD,PACKAGE_ID_XMSF,PACKAGE_ID_MAIL_163,PACKAGE_ID_TASKER,PACKAGE_ID_PUSHDEER]

// 公司的钉钉CorpId, 获取方法见 2020-09-24 更新日志。如果只加入了一家公司, 可以不填
const CORP_ID = "" 

// 锁屏意图, 配合 Tasker 完成锁屏动作, 具体配置方法见 2021-03-09 更新日志
const ACTION_LOCK_SCREEN = "autojs.intent.action.LOCK_SCREEN"

// 监听音量+键, 开启后无法通过音量+键调整音量, 按下音量+键：结束所有子线程
const OBSERVE_VOLUME_KEY = true

const WEEK_DAY = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday",]


// =================== ↓↓↓ 主线程：监听通知 ↓↓↓ ====================

var currentDate = new Date()

// 是否暂停定时打卡
var suspend = false

// 本次打开钉钉前是否需要等待
var needWaiting = true

// 运行日志路径
var globalLogFilePath = "/sdcard/脚本/Archive/" + getCurrentDate() + "-log.txt"

// 检查无障碍权限
auto.waitFor("normal")

// 检查Autojs版本
requiresAutojsVersion("4.1.0")

// 创建运行日志
console.setGlobalLogConfig({
    file: "/sdcard/脚本/Archive/" + getCurrentDate() + "-log.txt"
});

// 监听本机通知
events.observeNotification()    
events.on("notification", function(n) {
    notificationHandler(n)
});

events.setKeyInterceptionEnabled("volume_up", OBSERVE_VOLUME_KEY)

if (OBSERVE_VOLUME_KEY) {
    events.observeKey()
};
    
// 监听音量+键
events.onKeyDown("volume_up", function(event){
    threads.shutDownAll()
    device.setBrightnessMode(1)
    device.cancelKeepingAwake()
    toast("已中断所有子线程!")

    // 可以在此调试各个方法
    // doClock()
    // sendQQMsg("测试文本")
    // sendEmail("测试主题", "测试文本", null)
    // sendServerChan(测试主题, 测试文本)
    // sendPushDeer(测试主题, 测试文本)
});

toastLog("监听中, 请在日志中查看记录的通知及其内容")

// =================== ↑↑↑ 主线程：监听通知 ↑↑↑ =====================



/**
 * @description 处理通知
 */
function notificationHandler(n) {
    
    var packageId = n.getPackageName()  // 获取通知包名
    var abstract = n.tickerText         // 获取通知摘要
    var text = n.getText()              // 获取通知文本
    
    // 过滤 PackageId 白名单之外的应用所发出的通知
    if (!filterNotification(packageId, abstract, text)) { 
        return;
    }

    // 监听摘要为 "定时打卡" 的通知, 不一定要从 Tasker 中发出通知, 日历、定时器等App均可实现
    if (abstract == "定时打卡" && !suspend) { 
        needWaiting = true
        threads.shutDownAll()
        threads.start(function(){
            doClock()
        })
        return;
    }

    switch(text) {
        
        case "打卡": // 监听文本为 "打卡" 的通知
            needWaiting = false
            threads.shutDownAll()
            threads.start(function(){
                doClock()
            })
            break;

        case "查询": // 监听文本为 "查询" 的通知
            threads.shutDownAll()
            threads.start(function(){
                switch(DEFAULT_MESSAGE_DELIVER) {
                    case PUSH_METHOD.QQ:
                        sendQQMsg(getStorageData("dingding", "clockResult"))
                       break;
                    case PUSH_METHOD.Email:
                        sendEmail("考勤结果", getStorageData("dingding", "clockResult"), null)
                       break;
                    case PUSH_METHOD.ServerChan:
                        sendServerChan("考勤结果", getStorageData("dingding", "clockResult"))
                       break;
                    case PUSH_METHOD.PushDeer:
                        sendPushDeer("考勤结果", getStorageData("dingding", "clockResult"))
                       break;
                }
            })
            break;

        case "暂停": // 监听文本为 "暂停" 的通知
            suspend = true
            console.warn("暂停定时打卡")
            threads.shutDownAll()
            threads.start(function(){
                switch(DEFAULT_MESSAGE_DELIVER) {
                    case PUSH_METHOD.QQ:
                        sendQQMsg("修改成功, 已暂停定时打卡功能")
                       break;
                    case PUSH_METHOD.Email:
                        sendEmail("修改成功", "已暂停定时打卡功能", null)
                       break;
                    case PUSH_METHOD.ServerChan:
                        sendServerChan("修改成功", "已暂停定时打卡功能")
                       break;
                    case PUSH_METHOD.PushDeer:
                        sendPushDeer("修改成功", "已暂停定时打卡功能")
                       break;
                }
            })
            break;

        case "恢复": // 监听文本为 "恢复" 的通知
            suspend = false
            console.warn("恢复定时打卡")
            threads.shutDownAll()
            threads.start(function(){
                switch(DEFAULT_MESSAGE_DELIVER) {
                    case PUSH_METHOD.QQ:
                        sendQQMsg("修改成功, 已恢复定时打卡功能")
                       break;
                    case PUSH_METHOD.Email:
                        sendEmail("修改成功", "已恢复定时打卡功能", null)
                       break;
                    case PUSH_METHOD.ServerChan:
                        sendServerChan("修改成功", "已恢复定时打卡功能")
                       break;
                    case PUSH_METHOD.PushDeer:
                        sendPushDeer("修改成功", "已恢复定时打卡功能")
                       break;
                }
            })
            break;

        case "日志": // 监听文本为 "日志" 的通知
            threads.shutDownAll()
            threads.start(function(){
                sendEmail("获取日志", globalLogFilePath, globalLogFilePath)
            })
            break;

        default:
            break;
    }

    if (text == null) 
    return;
    
    // 监听钉钉返回的考勤结果
    if (packageId == PACKAGE_ID_DD && text.indexOf("考勤打卡") >= 0) { 
        setStorageData("dingding", "clockResult", text)
        threads.shutDownAll()
        threads.start(function() {
            switch(DEFAULT_MESSAGE_DELIVER) {
                case PUSH_METHOD.QQ:
                    sendQQMsg(text)
                   break;
                case PUSH_METHOD.Email:
                    sendEmail("考勤结果", text, cameraFilePath)
                   break;
                case PUSH_METHOD.ServerChan:
                    sendServerChan("考勤结果", text)
                   break;
                case PUSH_METHOD.PushDeer:
                    sendPushDeer("考勤结果", text)
                   break;
           }
        })
        return;
    }
}


/**
 * @description 打卡流程
 */
function doClock() {

    currentDate = new Date()
    console.log("本地时间: " + getCurrentDate() + " " + getCurrentTime())
    console.log("开始打卡流程!")

    brightScreen()      // 唤醒屏幕
    unlockScreen()      // 解锁屏幕
    holdOn()            // 随机等待
    signIn()            // 自动登录
    handleLate()        // 处理迟到
    attendKaoqin()      // 考勤打卡

    if (currentDate.getHours() <= 12) 
    clockIn()           // 上班打卡
    else 
    clockOut()          // 下班打卡
    
    lockScreen()        // 关闭屏幕
}


/**
 * @description 发送邮件流程
 * @param {string} title 邮件主题
 * @param {string} message 邮件正文
 * @param {string} attachFilePath 要发送的附件路径
 */
function sendEmail(title, message, attachFilePath) {

    console.log("开始发送邮件流程!")

    brightScreen()      // 唤醒屏幕
    unlockScreen()      // 解锁屏幕

    if(attachFilePath != null && files.exists(attachFilePath)) {
        console.info(attachFilePath)
        app.sendEmail({
            email: [EMAILL_ADDRESS], subject: title, text: message, attachment: attachFilePath
        })
    }
    else {
        console.error(attachFilePath)
        app.sendEmail({
            email: [EMAILL_ADDRESS], subject: title, text: message
        })
    }
    
    console.log("选择邮件应用")
    waitForActivity("com.android.internal.app.ChooserActivity") // 等待选择应用界面弹窗出现, 如果设置了默认应用就注释掉
    
    var emailAppName = app.getAppName(PACKAGE_ID_MAIL_163)
    if (null != emailAppName) {
        if (null != textMatches(emailAppName).findOne(1000)) {
            btn_email = textMatches(emailAppName).findOnce().parent()
            btn_email.click()
        }
    }
    else {
        console.error("不存在应用: " + PACKAGE_ID_MAIL_163)
        lockScreen()
        return;
    }

    // 网易邮箱大师
    var versoin = getPackageVersion(PACKAGE_ID_MAIL_163)
    console.log("应用版本: " + versoin)
    var sp = versoin.split(".")
    if (sp[0] == 6) {
        // 网易邮箱大师 6
        waitForActivity("com.netease.mobimail.activity.MailComposeActivity")
        id("send").findOne().click()
    }
    else {
        // 网易邮箱大师 7
        waitForActivity("com.netease.mobimail.module.mailcompose.MailComposeActivity")
        var input_address = id("input").findOne()
        if (null == input_address.getText()) {
            input_address.setText(EMAILL_ADDRESS)
        }
        id("iv_arrow").findOne().click()
        sleep(1000)
        id("img_send_bg").findOne().click()
    }
    
    // 内置电子邮件
    // waitForActivity("com.kingsoft.mail.compose.ComposeActivity")
    // id("compose_send_btn").findOne().click()

    console.log("正在发送邮件...")
    
    home()
    sleep(2000)
    lockScreen()    // 关闭屏幕
}


/**
 * @description 发送QQ消息
 * @param {string} message 消息内容
 */
function sendQQMsg(message) {

    console.log("发送QQ消息")
    
    brightScreen()      // 唤醒屏幕
    unlockScreen()      // 解锁屏幕

    app.startActivity({ 
        action: "android.intent.action.VIEW", 
        data:"mqq://im/chat?chat_type=wpa&version=1&src_type=web&uin=" + QQ, 
        packageName: "com.tencent.mobileqq", 
    });
    
    // waitForActivity("com.tencent.mobileqq.activity.SplashActivity")

    id("input").findOne().setText(message)
    id("fun_btn").findOne().click()

    home()
    sleep(1000)
    lockScreen()    // 关闭屏幕
}


/**
 * @description ServerChan推送
 * @param {string} title 标题
 * @param {string} message 消息
 */
 function sendServerChan(title, message) {

    console.log("向 ServerChan 发起推送请求")

    url = "https://sctapi.ftqq.com/" + SERVER_CHAN + ".send";

    res = http.post(encodeURI(url), {
        "title": title,
        "desp": message
    });

    console.log(res)
    sleep(1000)
    lockScreen()    // 关闭屏幕
}


/**
 * @description PushDeer推送
 * @param {string} title 标题
 * @param {string} message 消息
 */
 function sendPushDeer(title, message) {

    console.log("向 PushDeer 发起推送请求")

    url = "https://api2.pushdeer.com/message/push"

    res = http.post(encodeURI(url), {
        "pushkey": PUSH_DEER,
        "text": title,
        "desp": message,
        "type": "markdown",
    });

    console.log(res)
    sleep(1000)
    lockScreen()    // 关闭屏幕
}


/**
 * @description 唤醒设备
 */
function brightScreen() {

    console.log("唤醒设备")
    
    device.setBrightnessMode(0) // 手动亮度模式
    device.setBrightness(SCREEN_BRIGHTNESS)
    device.wakeUpIfNeeded() // 唤醒设备
    device.keepScreenOn()   // 保持亮屏
    sleep(1000) // 等待屏幕亮起
    
    if (!device.isScreenOn()) {
        console.warn("设备未唤醒, 重试")
        device.wakeUpIfNeeded()
        brightScreen()
    }
    else {
        console.info("设备已唤醒")
    }
    sleep(1000)
}


/**
 * @description 解锁屏幕
 */
function unlockScreen() {

    console.log("解锁屏幕")
    
    if (isDeviceLocked()) {

        gesture(
            320, // 滑动时间：毫秒
            [
                device.width  * 0.5,    // 滑动起点 x 坐标：屏幕宽度的一半
                device.height * 0.9     // 滑动起点 y 坐标：距离屏幕底部 10% 的位置, 华为系统需要往上一些
            ],
            [
                device.width / 2,       // 滑动终点 x 坐标：屏幕宽度的一半
                device.height * 0.1     // 滑动终点 y 坐标：距离屏幕顶部 10% 的位置
            ]
        )

        sleep(1000) // 等待解锁动画完成
        home()
        sleep(1000) // 等待返回动画完成
    }

    if (isDeviceLocked()) {
        console.error("上滑解锁失败, 请按脚本中的注释调整 gesture(time, [x1,y1], [x2,y2]) 方法的参数!")
        return;
    }
    console.info("屏幕已解锁")
}


/**
 * @description 随机等待
 */
function holdOn(){

    if (!needWaiting) {
        return;
    }

    var randomTime = random(LOWER_BOUND, UPPER_BOUND)
    toastLog(Math.floor(randomTime / 1000) + "秒后启动" + app.getAppName(PACKAGE_ID_DD) + "...")
    sleep(randomTime)
}


/**
 * @description 启动并登陆钉钉
 */
function signIn() {

    app.launchPackage(PACKAGE_ID_DD)
    console.log("正在启动" + app.getAppName(PACKAGE_ID_DD) + "...")

    setVolume(0) // 设备静音

    sleep(10000) // 等待钉钉启动

    if (currentPackage() == PACKAGE_ID_DD &&
        currentActivity() == "com.alibaba.android.user.login.SignUpWithPwdActivity") {
        console.info("账号未登录")

        var account = id("et_phone_input").findOne()
        account.setText(ACCOUNT)
        console.log("输入账号")

        var password = id("et_pwd_login").findOne()
        password.setText(PASSWORD)
        console.log("输入密码")
        
        var privacy = id("cb_privacy").findOne()
        privacy.click()
        console.log("同意隐私协议")
        
        var btn_login = id("btn_next").findOne()
        btn_login.click()
        console.log("正在登陆...")

        sleep(3000)
    }

    if (currentPackage() == PACKAGE_ID_DD &&
        currentActivity() != "com.alibaba.android.user.login.SignUpWithPwdActivity") {
        console.info("账号已登录")
        sleep(1000)
    }
}


/**
 * @description 处理迟到打卡
 */
function handleLate(){
   
    if (null != textMatches("迟到打卡").clickable(true).findOne(1000)) {
        btn_late = textMatches("迟到打卡").clickable(true).findOnce() 
        btn_late.click()
        console.warn("迟到打卡")
    }
    if (null != descMatches("迟到打卡").clickable(true).findOne(1000)) {
        btn_late = descMatches("迟到打卡").clickable(true).findOnce() 
        btn_late.click()
        console.warn("迟到打卡")
    }
}


/**
 * @description 使用 URL Scheme 进入考勤界面
 */
function attendKaoqin(){

    var url_scheme = "dingtalk://dingtalkclient/page/link?url=https://attend.dingtalk.com/attend/index.html"

    if(CORP_ID != "") {
        url_scheme = url_scheme + "?corpId=" + CORP_ID
    }

    var a = app.intent({
        action: "VIEW",
        data: url_scheme,
        //flags: [Intent.FLAG_ACTIVITY_NEW_TASK]
    });
    app.startActivity(a);
    console.log("正在进入考勤界面...")
    
    textContains("申请").waitFor()
    console.info("已进入考勤界面")
    sleep(1000)
}


/**
 * @description 上班打卡 
 */
function clockIn() {

    console.log("上班打卡...")

    if (null != textContains("已打卡").findOne(1000)) {
        console.info("已打卡")
        toast("已打卡")
        home()
        sleep(1000)
        return;
    }

    console.log("等待连接到考勤机...")
    sleep(2000)
    
    if (null != textContains("未连接").findOne(1000)) {
        console.error("未连接考勤机, 重新进入考勤界面!")
        back()
        sleep(2000)
        attendKaoqin()
        return;
    }

    textContains("已连接").waitFor()
    console.info("已连接考勤机")
    sleep(1000)

    if (null != textMatches("上班打卡").clickable(true).findOne(1000)) {
        btn_clockin = textMatches("上班打卡").clickable(true).findOnce()
        btn_clockin.click()
        console.log("按下打卡按钮")
    }
    else {
        click(device.width / 2, device.height * 0.560)
        console.log("点击打卡按钮坐标")
    }
    sleep(1000)
    handleLate() // 处理迟到打卡
    
    home()
    sleep(1000)
}


/**
 * @description 下班打卡 
 */
function clockOut() {

    console.log("下班打卡...")
    console.log("等待连接到考勤机...")
    sleep(2000)
    
    if (null != textContains("未连接").findOne(1000)) {
        console.error("未连接考勤机, 重新进入考勤界面!")
        back()
        sleep(2000)
        attendKaoqin()
        return;
    }

    textContains("已连接").waitFor()
    console.info("已连接考勤机")
    sleep(1000)

    if (null != textMatches("下班打卡").clickable(true).findOne(1000)) {
        btn_clockout = textMatches("下班打卡").clickable(true).findOnce()
        btn_clockout.click()
        console.log("按下打卡按钮")
        sleep(1000)
    }
    else {
        click(device.width / 2, device.height * 0.560)
        console.log("点击打卡按钮坐标")
    }

    if (null != textContains("早退打卡").clickable(true).findOne(1000)) {
        className("android.widget.Button").text("早退打卡").clickable(true).findOnce().parent().click()
        console.warn("早退打卡")
    }
    
    home()
    sleep(1000)
}


/**
 * @description 锁屏
 */
function lockScreen(){

    console.log("关闭屏幕")

    // 锁屏方案1：Root
    // Power()

    // 锁屏方案2：No Root
    // press(Math.floor(device.width / 2), Math.floor(device.height * 0.973), 1000) // 小米的快捷手势：长按Home键锁屏
    
    // 万能锁屏方案：向Tasker发送广播, 触发系统锁屏动作。配置方法见 2021-03-09 更新日志
    app.sendBroadcast({action: ACTION_LOCK_SCREEN});

    device.setBrightnessMode(1) // 自动亮度模式
    device.cancelKeepingAwake() // 取消设备常亮
    
    if (isDeviceLocked()) {
        console.info("屏幕已关闭")
    }
    else {
        console.error("屏幕未关闭, 请尝试其他锁屏方案, 或等待屏幕自动关闭")
    }
}



// ===================== ↓↓↓ 功能函数 ↓↓↓ =======================

function dateDigitToString(num){
    return num < 10 ? '0' + num : num
}

function getCurrentTime(){
    var currentDate = new Date()
    var hours = dateDigitToString(currentDate.getHours())
    var minute = dateDigitToString(currentDate.getMinutes())
    var second = dateDigitToString(currentDate.getSeconds())
    var formattedTimeString = hours + ':' + minute + ':' + second
    return formattedTimeString
}

function getCurrentDate(){
    var currentDate = new Date()
    var year = dateDigitToString(currentDate.getFullYear())
    var month = dateDigitToString(currentDate.getMonth() + 1)
    var date = dateDigitToString(currentDate.getDate())
    var week = currentDate.getDay()
    var formattedDateString = year + '-' + month + '-' + date + '-' + WEEK_DAY[week]
    return formattedDateString
}

// 通知过滤器
function filterNotification(bundleId, abstract, text) {
    var check = PACKAGE_ID_WHITE_LIST.some(function(item) {return bundleId == item}) 
    if (!NOTIFICATIONS_FILTER || check) {
        console.verbose(bundleId)
        console.verbose(abstract)
        console.verbose(text)
        console.verbose("---------------------------")
        return true
    }
    else {
        return false 
    }
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

// 获取应用版本号
function getPackageVersion(bundleId) {
    importPackage(android.content)
    var pckMan = context.getPackageManager()
    var packageInfo = pckMan.getPackageInfo(bundleId, 0)
    return packageInfo.versionName
}

// 屏幕是否为锁定状态
function isDeviceLocked() {
    importClass(android.app.KeyguardManager)
    importClass(android.content.Context)
    var km = context.getSystemService(Context.KEYGUARD_SERVICE)
    return km.isKeyguardLocked()
}

// 设置媒体和通知音量
function setVolume(volume) {
    device.setMusicVolume(volume)
    device.setNotificationVolume(volume)
    console.verbose("媒体音量:" + device.getMusicVolume())
    console.verbose("通知音量:" + device.getNotificationVolume())
}
