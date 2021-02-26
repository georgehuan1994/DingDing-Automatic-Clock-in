/*
 * @Author: George Huan
 * @Date: 2020-08-03 09:30:30
 * @LastEditTime: 2021-02-26 14:58:38
 * @Description: DingDing-Automatic-Clock-in (Run on AutoJs)
 * @URL: https://github.com/georgehuan1994/DingDing-Automatic-Clock-in
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

// 执行时的屏幕亮度（0-255）
const SCREEN_BRIGHTNESS = 20    

// 是否过滤通知
const NOTIFICATIONS_FILTER = false; 

// BundleId白名单
const BUNDLE_ID_WHITE_LIST = [BUNDLE_ID_DD,BUNDLE_ID_XMSF,BUNDLE_ID_MAIL,BUNDLE_ID_TASKER, ]

const WEEK_DAY = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday",]

// 公司的钉钉CorpId，获取方法见更新日志，可留空
const CORP_ID = "" 


// =================== ↓↓↓ 主线程：监听通知 ↓↓↓ ====================

var suspend = false
var needWaiting = true
var currentDate = new Date()

// 检查无障碍权限启动
auto.waitFor("normal")

// 创建运行日志
console.setGlobalLogConfig({
    file: "/sdcard/脚本/Archive/" + getCurrentDate() + "-log.txt"
});

// 监听本机通知
events.observeNotification()    
events.on("notification", function(n) {
    notificationHandler(n)
});

toastLog("监听中，请在日志中查看记录的通知及其内容")

// =================== ↑↑↑ 主线程：监听通知 ↑↑↑ =====================



/**
 * @description 处理通知
 */
function notificationHandler(n) {
    
    var bundleId = n.getPackageName()    // 获取通知包名
    var abstract = n.tickerText          // 获取通知摘要
    var text = n.getText()               // 获取通知文本

    // 过滤BundleId白名单之外的应用所发出的通知
    if (!filterNotification(bundleId, abstract, text)) { 
        return;
    }

    // 监听摘要为 "定时打卡" 的通知，不一定要从 Tasker 中发出通知，日历、定时器等App均可实现
    if (abstract == "定时打卡" && !suspend) { 
        needWaiting = true
        threads.shutDownAll()
        threads.start(function(){
            doClock()
        })
        return;
    }
    
    // 监听文本为 "打卡" 的通知
    if ((bundleId == BUNDLE_ID_MAIL || bundleId == BUNDLE_ID_XMSF) && (text == "Re: 打卡" || text == "打卡")) { 
        needWaiting = false
        threads.shutDownAll()
        threads.start(function(){
            doClock()
        })
        return;
    }
    
    // 监听文本为 "考勤结果" 的通知 
    if ((bundleId == BUNDLE_ID_MAIL || bundleId == BUNDLE_ID_XMSF) && (text == "Re: 考勤结果" || text == "考勤结果")) {
        threads.shutDownAll()
        threads.start(function(){
            sendEmail("考勤结果", getStorageData("dingding", "clockResult"))
        })
        return;
    }

    // 监听文本为 "暂停" 的通知 
    if ((bundleId == BUNDLE_ID_MAIL || bundleId == BUNDLE_ID_XMSF) && text == "暂停") {
        suspend = true
        console.warn("暂停定时打卡")
        threads.shutDownAll()
        threads.start(function(){
            sendEmail("操作成功", "已暂停定时打卡功能")
        })
        return;
    }

    // 监听文本为 "恢复" 的通知 
    if ((bundleId == BUNDLE_ID_MAIL || bundleId == BUNDLE_ID_XMSF) && text == "恢复") {
        suspend = false
        console.warn("恢复定时打卡")
        threads.shutDownAll()
        threads.start(function(){
            sendEmail("操作成功", "已恢复定时打卡功能")
        })
        return;
    }

    if (text == null) {
        return;
    }
    
    // 监听钉钉返回的考勤结果
    if (bundleId == BUNDLE_ID_DD && text.indexOf("考勤打卡") >= 0) { 
        setStorageData("dingding", "clockResult", text)
        threads.shutDownAll()
        threads.start(function(){
            sendEmail("考勤结果", text)
        })
        return;
    }
}


/**
 * @description 打卡主程序 
 */
function doClock() {

    currentDate = new Date()
    console.log("本地时间：" + getCurrentDate() + " " + getCurrentTime())
    console.log("开始打卡流程！")

    brightScreen()      // 唤醒屏幕
    unlockScreen()      // 解锁屏幕
    stopApp()           // 结束钉钉
    holdOn()            // 随机等待
    signIn()            // 自动登录
    handleUpdata()      // 处理更新
    handleLate()        // 处理迟到

    attendKaoqin()      // 使用 URL Scheme 进入考勤界面

    if (currentDate.getHours() <= 12) {
        clockIn()       // 上班打卡
    }
    else {
        clockOut()      // 下班打卡
    }
    lockScreen()        // 关闭屏幕
}


/**
 * @description 发邮件主程序 
 * @param {*} title 邮件主题
 * @param {*} message 邮件正文
 */
function sendEmail(title, message) {

    console.log("开始发送邮件流程！")

    brightScreen()  // 唤醒屏幕
    unlockScreen()  // 解锁屏幕

    app.sendEmail({
        email: [EMAILL_ADDRESS],
        subject: title,
        text: message
    })
    
    // 等待选择应用界面弹窗出现，如果设置了默认应用就注释掉
    waitForActivity("com.android.internal.app.ChooserActivity")
    
    if (null != textMatches(NAME_OF_EMAILL_APP).findOne(3000)) {
        btn_email = textMatches(NAME_OF_EMAILL_APP).findOnce().parent()
        btn_email.click()
    }
    else {
        console.error("没有找到" + NAME_OF_EMAILL_APP)
        lockScreen()
        return;
    }

    waitForActivity("com.netease.mobimail.activity.MailComposeActivity")
    id("send").findOne().click()

    console.log("正在发送邮件...")
    
    home()
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

    console.info("设备已唤醒")
    
    sleep(1000) // 等待屏幕亮起
    if (!device.isScreenOn()) {
        console.warn("设备未唤醒，重试")
        device.wakeUpIfNeeded()
        brightScreen()
    }
    sleep(1000)
}


/**
 * @description 解锁屏幕
 */
function unlockScreen() {

    console.log("解锁屏幕")
    
    gesture(320,[540,device.height * 0.9],[540,device.height * 0.1]) // 上滑解锁
    sleep(1000) // 等待解锁动画完成
    home()
    sleep(1000) // 等待返回动画完成
    
    console.info("屏幕已解锁")
}


/**
 * @description 结束钉钉进程
 */
function stopApp() {

    console.log("结束钉钉进程")

    // Root
    // shell('am force-stop ' + BUNDLE_ID_DD, true) 

    // No Root
    app.openAppSetting(BUNDLE_ID_DD)
    let btn_finish = textMatches(/(.*结束.*)|(.*停止.*)/).clickable(true).findOne() // 直到找到 "结束运行" 按钮，并点击
    if (btn_finish.enabled()) {
        btn_finish.click()
        
        if (null != textMatches("确定").clickable(true).findOne(1000)) { // 点击弹出的对话框中的 "确定" 按钮
            btn_sure = textMatches("确定").clickable(true).findOnce()
            btn_sure.click() 
        }
        if (null != descMatches("确定").clickable(true).findOne(1000)) {
            btn_sure = descMatches("确定").clickable(true).findOnce()
            btn_sure.click() 
        }
        console.info(app.getAppName(BUNDLE_ID_DD) + "已被关闭")
    } 
    else {
        console.info(app.getAppName(BUNDLE_ID_DD) + "未在运行")
    }
    sleep(1000)
    home()
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
    console.log("正在启动" + app.getAppName(BUNDLE_ID_DD) + "...")
    
    sleep(10000)    // 等待钉钉启动
    handleUpdata()  // 处理更新弹窗

    if (id("et_pwd_login").exists()) {
        console.info("账号未登录")

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
            console.info("账号已登录，当前位于消息页面")
            sleep(1000)
        } 
        else {
            console.warn("未检测到消息页面，重试")
            signIn()
        }
    }
}


/**
 * @description 处理钉钉更新弹窗
 */
function handleUpdata(){

    if (null != textMatches(/(.*暂不更新.*)/).clickable(true).findOne(3000)) {
        btn_dontUpdate = textMatches("暂不更新").clickable(true).findOnce()
        btn_dontUpdate.click()
        sleep(1000)
        console.error("发现更新弹窗！请留意新版本的布局变化！")
    }
}


/**
 * @description 处理迟到打卡
 */
function handleLate(){
   
    if (null != textMatches(/(.*迟到打卡.*)/).clickable(true).findOne(1000)) {
        btn_late = textMatches("迟到打卡").clickable(true).findOnce() 
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
    sleep(6000)
    
    if (null != textMatches("申请").clickable(true).findOne(3000)) {
        console.info("已进入考勤界面")
        sleep(1000)
    }
}


/**
 * @description 上班打卡 
 */
function clockIn() {

    console.log("上班打卡...")
    
    if (null != textContains("已打卡").findOne(1000)) {
        toastLog("已打卡")
        home()
        sleep(1000)
        return;
    }

    console.log("等待连接到考勤机...")
    sleep(2000)
    
    if (null != textContains("未连接").findOne(1000)) {
        console.error("未连接考勤机，重新进入考勤界面！")
        attendKaoqin()
    }

    textContains(NAME_OF_ATTENDANCE_MACHINE).waitFor()
    console.info("已连接考勤机：" + NAME_OF_ATTENDANCE_MACHINE)
    sleep(1000)

    if (null != textMatches(/(.*上班打卡.*)/).clickable(true).findOne(1000)) {
        // btn_clockin = textMatches("上班打卡").clickable(true).findOnce().parent().parent().click()
        // btn_clockin = textMatches("上班打卡").clickable(true).findOnce().parent().click()
        btn_clockin = textMatches("上班打卡").clickable(true).findOnce();
        btn_clockin.click()
        console.log("按下打卡按钮")
        sleep(1000)
    }

    // 因上班打卡按钮有可能获取不到，故使用打卡按钮坐标作为保险操作
    click(Math.floor(device.width / 2),Math.floor(device.height * 0.560))
    sleep(200)
    click(Math.floor(device.width / 2),Math.floor(device.height * 0.563))
    sleep(200)
    click(Math.floor(device.width / 2),Math.floor(device.height * 0.566))
    console.log("使用坐标按下打卡按钮")
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

    if (null != textContains("更新打卡").findOne(1000)) {
        if (null != textContains("早退").findOne(1000)) {
            toastLog("早退，更新打卡记录")
        }
        else {
            home()
            sleep(1000)
            return;
        }
    }

    console.log("等待连接到考勤机...")
    sleep(2000)
    
    if (null != textContains("未连接").findOne(1000)) {
        console.error("未连接考勤机，重新进入考勤界面！")
        attendKaoqin()
    }

    textContains(NAME_OF_ATTENDANCE_MACHINE).waitFor()
    console.info("已连接考勤机：" + NAME_OF_ATTENDANCE_MACHINE)
    sleep(1000)

    if (null != textMatches(/(.*下班打卡.*)/).clickable(true).findOne(1000)) {
        btn_clockout = textMatches("下班打卡").clickable(true).findOnce()
        btn_clockout.click()
        console.log("按下打卡按钮")
        sleep(1000)
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

    device.setBrightnessMode(1) // 自动亮度模式
    device.cancelKeepingAwake() // 取消设备常亮
    
    // Root
    // Power()

    // No Root
    press(Math.floor(device.width / 2), Math.floor(device.height * 0.973), 1000) // 小米的快捷手势：长按Home键锁屏
}


// ===================== 功能函数 =======================

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
    
    var check = BUNDLE_ID_WHITE_LIST.some(function(item) {return bundleId == item})
    
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
