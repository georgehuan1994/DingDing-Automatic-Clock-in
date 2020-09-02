# DingDing-Automatic-Clock-in
## 简介
钉钉自动打卡脚本，基于AutoJs，免Root

## 功能
1. 定时自动打卡
2. 远程指令打卡
3. 发送打卡结果

## 工具
1. AutoJs (4.1.1a Alpha2-armeabi-v7a-release)
2. Tasker
3. 网易邮箱大师

## 原理
在AutoJs脚本中监听本机通知，并在tasker中创建定时任务发出打卡通知，或在另一设备上发送消息到本机，即可触发脚本中的打卡进程，以实现定时打卡和远程打卡的功能。当然也可以通过发送应用间广播或其他推送的方式来实现

因为部分操作仍要基于坐标，所以在使用前，需要对脚本做一些调整，来适配你的设备！

## 脚本
```javascript
/*
 * @Author: George Huan
 * @Date: 2020-08-03 09:30:30
 * @LastEditTime: 2020-09-02 15:30:48
 * @Description: DingDing-Automatic-Clock-in (tasker + AutoJs)
 */

const ACCOUNT = "账号"
const PASSWORD = "密码"
const BUNDLE_ID_DD = "com.alibaba.android.rimet"
const BUNDLE_ID_XMSF = "com.xiaomi.xmsf"
const BUNDLE_ID_MAIL = "com.netease.mail"
const EMAILL_ADDRESS = "收件邮箱地址"
const NAME_OF_ATTENDANCE_MACHINE = "前台大门" // 考勤机名称片段

const LOWER_BOUND = 0 * 60 * 1000 // 最小随机等待时间：1min
const UPPER_BOUND = 0 * 60 * 1000 // 最大随机等待时间：5min

const BUTTON_HOME_POS_X = 540   // Home键坐标x
const BUTTON_HOME_POS_Y = 2278  // Home键坐标y

const BUTTON_KAOQIN_X = 130     // 考勤打卡控件坐标x
const BUTTON_KAOQIN_Y = 1007    // 考勤打卡控件坐标y

const BUTTON_DAKA_X = 540   // 打卡按钮坐标x
const BUTTON_DAKA_Y = 1325  // 打卡按钮坐标y

const BUTTON_SEND_EMAIL_X = 1014    // 邮件发送按钮坐标x
const BUTTON_SEND_EMAIL_Y = 138     // 邮件发送按钮坐标y

const SCREEN_BRIGHTNESS = 20    // 执行时的屏幕亮度（0-255）

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

// 检查无障碍权限启动
auto.waitFor("fast")

// 监听本机通知
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
    // 监听摘要为 "定时打卡" 的通知
    if (abstract == "定时打卡") {
        needWaiting = true
        do_main()
        press(BUTTON_HOME_POS_X, BUTTON_HOME_POS_Y, 1000) // 快捷手势：长按Home键锁屏。也可使用Power()函数，模拟按下电源键，此函数依赖于root权限
    }
    // 监听文本为 "打卡" 的通知，为避免重复触发，只监听厂商推送服务（com.xiaomi.xmsf）或邮箱应用（com.netease.mail）的通知
    if (bundleId == BUNDLE_ID_XMSF && text == "打卡") {
        needWaiting = false
        do_main()
        press(BUTTON_HOME_POS_X, BUTTON_HOME_POS_Y, 1000)
    }
}

function do_main(){
    console.show()              // 显示控制台
    sleep(100)                  // 等待控制台出现
    console.setSize(800,450)    // 调整控制台尺寸

    currentDate = new Date()
    console.info("当前：" + getCurrentDate() + " " + getCurrentTime()) 
    console.log("开始执行主程序")

    device.setBrightnessMode(0) // 手动亮度模式
    device.setBrightness(SCREEN_BRIGHTNESS)
    
    bright_screen()     // 唤醒屏幕
    unlock_screen()     // 解锁屏幕
    stop_app()          // 结束钉钉
    wait_a_minute()     // 随机等待
    is_login()          // 自动登录
    handle_updata()     // 处理更新
    handle_late()       // 处理迟到
    in_gongzuo()        // 进入工作台
    in_kaoqin()         // 进入考勤打卡界面

    if (currentDate.getHours() <= 12) {
        do_clock_in()   // 上班打卡
    }
    else {
        do_clock_out()  // 下班打卡
    }
    send_email()        // 发送邮件

    device.setBrightnessMode(1) // 自动亮度模式
    device.cancelKeepingAwake() // 取消设备常亮
    
    console.info("主程序执行完毕，关闭屏幕")
    console.hide() // 关闭控制台
}

function bright_screen() {
    console.info("唤醒设备")
    device.wakeUpIfNeeded() // 唤醒设备
    device.keepScreenOn()   // 保持亮屏
    console.log("已唤醒")
    sleep(1000) // 等待屏幕亮起
    if (!device.isScreenOn()) {
        console.warn("设备未唤醒")
        device.wakeUpIfNeeded()
        bright_screen()
    }
}

function unlock_screen() {
    console.info("解锁屏幕")
    gesture(320,[540,device.height * 0.9],[540,device.height * 0.1]) // 上滑解锁
    sleep(1000) // 等待解锁动画完成
    home()
    sleep(1000) // 等待返回动画完成
    console.log("已解锁")
}

function stop_app() {
    console.info("结束钉钉进程")
    // shell('am force-stop ' + BUNDLE_ID_DD, true)
    
    // 已获取Root权限的同学用上面这一句就行
    // 未获取Root权限的同学要根据自己的手机来修改调试一下
    
    app.openAppSetting(BUNDLE_ID_DD)
    text(app.getAppName(BUNDLE_ID_DD)).waitFor()
    let is_sure = textMatches("结束运行").clickable(true).findOne() // 找到 "结束运行" 按钮，并点击
    if (is_sure.enabled()) {
        sleep(1000)
        is_sure.click()
        sleep(1000)
        textMatches("确定").clickable(true).findOne().click() // 找到 "确定" 按钮，并点击
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

function wait_a_minute(){
    if (!needWaiting) {
        return;
    }
    var randomTime = random(LOWER_BOUND, UPPER_BOUND)
    log(Math.floor(randomTime / 1000) + "秒后启动" + app.getAppName(BUNDLE_ID_DD) + "...")
    toast(Math.floor(randomTime / 1000) + "秒后启动" + app.getAppName(BUNDLE_ID_DD) + "...")
    sleep(randomTime)
}

function is_login() {
    app.launchPackage(BUNDLE_ID_DD);
    console.info("正在启动" + app.getAppName(BUNDLE_ID_DD) + "...")
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
    textContains(NAME_OF_ATTENDANCE_MACHINE).waitFor()
    console.log("已连接")
    sleep(1000)
    click(BUTTON_DAKA_X,BUTTON_DAKA_Y)
    sleep(50)
    click(BUTTON_DAKA_X,BUTTON_DAKA_Y)
    sleep(50)
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
    textContains(NAME_OF_ATTENDANCE_MACHINE).waitFor()
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
        message = "下班打卡成功" + message
        toast("下班打卡成功")
    }
    home()
    sleep(1000)
}

function send_email(){
    console.info("发送邮件...")
    app.sendEmail({
        email: [EMAILL_ADDRESS],
        subject: "打卡结果",
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
    message = ""
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

/*
 *                        _oo0oo_
 *                       o8888888o
 *                       88" . "88
 *                       (| -_- |)
 *                       0\  =  /0
 *                     ___/`---'\___
 *                   .' \\|     |// '.
 *                  / \\|||  :  |||// \
 *                 / _||||| -:- |||||- \
 *                |   | \\\  - /// |   |
 *                | \_|  ''\---/''  |_/ |
 *                \  .-\__  '-'  ___/-. /
 *              ___'. .'  /--.--\  `. .'___
 *           ."" '<  `.___\_<|>_/___.' >' "".
 *          | | :  `- \`.;`\ _ /`;.`/ - ` : | |
 *          \  \ `_.   \_ __\ /__ _/   .-` /  /
 *      =====`-.____`.___ \_____/___.-`___.-'=====
 *                        `=---='
 * 
 * 
 *      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * 
 *            佛祖保佑       永不宕机     永无BUG
 * 
 *        佛曰:  
 *                写字楼里写字间，写字间里程序员；  
 *                程序人员写程序，又拿程序换酒钱。  
 *                酒醒只在网上坐，酒醉还来网下眠；  
 *                酒醉酒醒日复日，网上网下年复年。  
 *                但愿老死电脑间，不愿鞠躬老板前；  
 *                奔驰宝马贵者趣，公交自行程序员。  
 *                别人笑我忒疯癫，我笑自己命太贱；  
 *                不见满街漂亮妹，哪个归得程序员？
 * 
 *                希望阿里的老哥老姐给留一条生路！
*/
```

## 使用方法
### AutoJs
下载：[Auto.js 4.1.1a Alpha2-armeabi-v7a-release](https://www.lanzous.com/i56aexi "Auto.js 4.1.1a Alpha2-armeabi-v7a-release")

AutoJs是安卓平台上的JavaScript自动化工具 https://github.com/hyb1996/Auto.js

官方文档已失效，第三方文档：https://www.easydoc.xyz/doc/25791054/uw2FUUiw/3bEzXb4y

PC和手机连接到同一网络，使用 VSCode + Auto.js插件（在扩展中心搜索 "hyb1996"） 可方便的调试并将脚本保存到手机上

### Tasker
![](https://github.com/georgehuan1994/DingDing-Automatic-Clock-in/blob/master/%E5%9B%BE%E7%89%87/%E6%88%AA%E5%9B%BE_004.jpg)
1. 添加一个 "通知" 操作任务，通知标题修改为 "定时打卡"，通知文字随意，通知优先级设为 1
2. 添加两个配置文件，使用日期和时间作为条件，分别在上班前和下班后触发
或[下载任务和配置文件](https://github.com/georgehuan1994/DingDing-Automatic-Clock-in/tree/master/Tasker配置 "下载配置")导入Tasker中

### 邮箱应用
使用原生的邮箱容易受限，导致邮件发送失败，所以找一个你喜欢的邮箱应用并添加一个邮箱地址

### 调试
根据脚本中的注释，针对自己的设备来修改并调试脚本

## 更新日志
2020-09-02：钉钉工作台界面改版（新增考勤打卡的快捷入口）。无法通过 "考勤打卡" 相关属性获取控件，改为使用 "去打卡" 文本获取按钮。若找不到 "去打卡" 按钮，则直接点击 "考勤打卡" 的屏幕坐标
