/*
 * @Author: George Huan
 * @Date: 2020-08-03 09:30:30
 * @LastEditTime: 2020-09-02 12:03:14
 * @Description: DingDing-Automatic-Clock-in (tasker + AutoJs)
 */

const ACCOUNT = "Enter your account here" // 账号
const PASSWORD = "Enter your password here" // 密码
const BUNDLE_ID = "com.alibaba.android.rimet"
const EMAILL_ADDRESS = "Enter your email address" // 邮箱地址

const LOWER_BOUND = 1 * 60 * 1000 // 最小随机等待时间：1min
const UPPER_BOUND = 5 * 60 * 1000 // 最大随机等待时间：5min

const BUTTON_HOME_POS_X = 540 // Home键坐标x
const BUTTON_HOME_POS_Y = 2278 // Home键坐标y

const BUTTON_KAOQIN_X = 130 // 考勤打卡控件坐标x
const BUTTON_KAOQIN_Y = 1007 // 考勤打卡控件坐标y

const BUTTON_DAKA_X = 540 // 打卡按钮坐标x
const BUTTON_DAKA_Y = 1325 // 打卡按钮坐标y

const BUTTON_SEND_EMAIL_X = 1014 // 邮件发送按钮坐标x
const BUTTON_SEND_EMAIL_Y = 138 // 邮件发送按钮坐标y

const SCREEN_BRIGHTNESS = 20 // 执行时的屏幕亮度（0-255）

var weekday = new Array(7);
weekday[0] = "Sunday"
weekday[1] = "Monday"
weekday[2] = "Tuesday"
weekday[3] = "Wednesday"
weekday[4] = "Thursday"
weekday[5] = "Friday"
weekday[6] = "Saturday"
var needWaiting = true
var currentDate = new Date()
var message = ""

 // 检查无障碍权限启动
auto.waitFor("fast")

// 监听tasker发出的通知
events.observeNotification()
events.onNotification(function(notification) {
    printNotification(notification)
});
toast("监听中，请在日志中查看记录的通知及其内容")

function printNotification(notification) {
    var bundleId = notification.getPackageName()
    var abstract = notification.tickerText
    var text = notification.getText()

    if (bundleId != "android") {
        console.log(bundleId)
        console.log(text)
        console.log("---------------------------")
    }
    if (abstract == "定时打卡") {
        needWaiting = true
        do_main()
        press(BUTTON_HOME_POS_X, BUTTON_HOME_POS_Y, 1000) // 快捷手势：长按Home键锁屏。也可使用Power()函数，模拟按下电源键，此函数依赖于root权限
    }
    // 为避免重复触发，只监听小米推送服务的通知（com.netease.mail）
    if (bundleId == "com.xiaomi.xmsf" && text == "打卡") {
        needWaiting = false
        do_main()
        press(BUTTON_HOME_POS_X, BUTTON_HOME_POS_Y, 1000)
    }
}

function do_main(){
    currentDate = new Date()
    console.show() // 显示控制台
    sleep(100)
    console.setSize(800,450)
    console.info("当前：" + getCurrentDate() + " " + getCurrentTime()) 
    console.log("开始执行主程序")
    device.setBrightnessMode(0) // 手动亮度模式
    device.setBrightness(SCREEN_BRIGHTNESS)
    bright_screen()
    unlock_screen()
    stop_app()
    wait_a_minute()
    is_login()
    handle_updata()
    handle_late()
    in_gongzuo()
    in_kaoqin()
    if (currentDate.getHours() <= 12) {
        do_clock_in()
    }
    else {
        do_clock_out()
    }
    send_email()
    device.setBrightnessMode(1) // 自动亮度模式
    device.cancelKeepingAwake() // 取消设备常亮
    console.info("主程序执行完毕，关闭屏幕")
    console.hide() // 关闭控制台
}

function bright_screen() {
    console.info("唤醒设备")
    device.wakeUpIfNeeded() // 唤醒设备
    device.keepScreenOn() // 保持亮屏
    console.log("已唤醒")
    sleep(1000); // 等待屏幕亮起
    if (!device.isScreenOn()) {
        console.warn("设备未唤醒")
        device.wakeUpIfNeeded()
        bright_screen()
    }
}

function unlock_screen() {
    console.info("解锁屏幕")
    gesture(320,[540,device.height * 0.9],[540,device.height * 0.1])
    sleep(1000)
    home()
    sleep(1000)
    console.log("已解锁")
    sleep(1000)
}

function stop_app() {
    console.info("结束钉钉进程")
    // shell('am force-stop ' + BUNDLE_ID, true) // 依赖于root权限
    app.openAppSetting(BUNDLE_ID)
    text(app.getAppName(BUNDLE_ID)).waitFor()
    let is_sure = textMatches("结束运行").clickable(true).findOne()
    if (is_sure.enabled()) {
        sleep(1000)
        is_sure.click()
        sleep(1000)
        textMatches("确定").clickable(true).findOne().click()
        console.log(app.getAppName(BUNDLE_ID) + "已被关闭")
        sleep(1000)
        home()
    } else {
        console.log(app.getAppName(BUNDLE_ID) + "未在运行")
        sleep(1000)
        home()
    }
    sleep(1000)
}

function wait_a_minute(){
    if (!needWaiting) {
        return;
    }
    var randomTime = random(LOWER_BOUND, UPPER_BOUND)
    log(Math.floor(randomTime / 1000) + "秒后启动" + app.getAppName(BUNDLE_ID) + "...")
    toast(Math.floor(randomTime / 1000) + "秒后启动" + app.getAppName(BUNDLE_ID) + "...")
    sleep(randomTime)
}

function is_login() {
    app.launchPackage(BUNDLE_ID);
    console.info("正在启动" + app.getAppName(BUNDLE_ID) + "...")
    sleep(10000)
    handle_updata() // 为保证线程安全，不使用多线程监听，主动调用方法处理更新弹窗
    if (id("et_pwd_login").exists()) {
        console.log("账号未登录")
        var account = id("et_phone_input").findOne()
        account.setText(ACCOUNT)
        console.log("输入账号")
        var password = id("et_pwd_login").findOne()
        sleep(1000)
        password.setText(PASSWORD)
        console.log("输入密码")
        id("btn_next").findOne().click()
        console.log("登录成功")
    } else {
        if (className("android.widget.RelativeLayout").exists()) {
            console.log("账号已登录，当前位于活动页面")
            sleep(1000)
        } else {
            console.warn("未检测到活动页面，重试")
            is_login()
        }
    }
}

function handle_updata(){
    if (null != textMatches("暂不更新").clickable(true).findOne(3000)) {
        console.info("发现更新弹窗")
        anniu_dontUpdate = textMatches(/(.*暂不更新.*)/).findOnce()
        anniu_dontUpdate.click()
        console.log("暂不更新")
        sleep(1000)
    }
}

function handle_late(){
    if (null != descMatches("迟到打卡").clickable(true).findOne(1000)) {
        console.log("在desc中找到迟到打卡")
        desc("迟到打卡").findOne().click()
    }
    if (null != textMatches("迟到打卡").clickable(true).findOne(1000)) {
        console.log("在text中找到迟到打卡")
        text("迟到打卡").findOne().click()
    }
}

function in_gongzuo(){
    if (null != descMatches("工作台").clickable(true).findOne(3000)) {
        toast("在desc中找到了工作台按钮")
        anniu_gongzou = descMatches(/(.*工作台.*)/).findOnce()
    }
    sleep(500)
    anniu_gongzou.click()
    console.info("正在进入工作台...")
    sleep(5000)
    if (id("menu_work_info").exists()) {
        console.log("已进入工作台页面")
        sleep(1000)
    }
}

function in_kaoqin(){
    if (null != textMatches("去打卡").clickable(true).findOne(3000)) {
        console.log("在text中找到去打卡按钮")
        anniu_kaoqin = textMatches(/(.*去打卡.*)/).clickable(true).findOnce() 
        sleep(1000)
        anniu_kaoqin.click()
    }
    else {
        click(BUTTON_KAOQIN_X,BUTTON_KAOQIN_Y)
    }
    console.info("正在进入考勤打卡页面...")
    sleep(6000)
    if (null != textMatches("申请").clickable(true).findOne(3000)) {
        console.log("已进入考勤打卡页面")
        sleep(1000)
    }
}

function do_clock_in() {
    console.info("上班打卡...")
    if (null != textContains("已打卡").findOne(1000)) {
        console.log("已打卡")
        message = "已打卡"
        toast("已打卡")
        home()
        sleep(1000)
        return;
    }
    console.log("等待连接到考勤机...")
    textContains("前台大门").waitFor()
    console.log("已连接")
    sleep(1000)
    click(BUTTON_DAKA_X,BUTTON_DAKA_Y)
    sleep(100)
    click(BUTTON_DAKA_X,BUTTON_DAKA_Y)
    sleep(100)
    click(BUTTON_DAKA_X,BUTTON_DAKA_Y)
    console.log("按下打卡按钮")
    sleep(1000)
    handle_late()
    if (null != textMatches("我知道了").clickable(true).findOne(1000)) {
        text("我知道了").findOne().click()
    }
    sleep(2000);
    if (null != textContains("上班打卡成功").findOne(3000)) {
        console.log("上班打卡成功")
        message = "上班打卡成功"
        toast("上班打卡成功")
    }
    home()
    sleep(1000)
}

function do_clock_out() {
    console.info("下班打卡...")
    console.log("等待连接到考勤机...")
    textContains("前台大门").waitFor()
    console.log("已连接")
    if (null != textMatches("下班打卡").clickable(true).findOne(1000)) {
        textMatches(/(.*下班打卡.*)/).findOnce().click()
    }
    console.log("按下打卡按钮")
    sleep(1000)
    if (null != textContains("早退打卡").clickable(true).findOne(1000)) {
        console.log("早退打卡")
        message = "早退打卡"
        className("android.widget.Button").text("早退打卡").findOnce().parent().click()
    }
    if (null != textMatches("我知道了").clickable(true).findOne(1000)) {
        text("我知道了").findOne().click()
    }
    sleep(2000);
    if (null != textContains("下班打卡成功").findOne(3000)) {
        console.log("下班打卡成功")
        message = "下班打卡成功"
        toast("下班打卡成功")
    }
    home()
    sleep(1000)
}

function send_email(){
    console.info("发送邮件...")
    app.sendEmail({
        email: [EMAILL_ADDRESS],
        subject: "打卡成功",
        text: getCurrentDate() + " " + getCurrentTime() + " " + message
    })
    textContains("发送邮件").waitFor()
    if (null != textMatches("网易邮箱大师").findOne(3000)) {
        anniu_email = textMatches(/(.*网易邮箱大师.*)/).findOnce().parent()
        anniu_email.click()
    }
    textContains("收件人").waitFor()
    click(BUTTON_SEND_EMAIL_X,BUTTON_SEND_EMAIL_Y)
    console.log("已发送")
    home()
    sleep(1000)
}

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
