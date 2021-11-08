# -*- coding: utf-8 -*-
# @Author: Anderson
# @Date:   2019-12-19 18:01:52
# @Last Modified by:   ander
# @Last Modified time: 2021-08-06 14:13:30
from browser import document as doc, window
import sys
import time
import traceback
import javascript


has_ace = True
try:
    editor = window.ace.edit("editor")
    session = editor.getSession()
    session.setMode("ace/mode/python")
    editor.setTheme("ace/theme/monokai")
    editor.setOptions({
        'enableLiveAutocompletion': True,
        'enableSnippets': True,
        'highlightActiveLine': False,
        'highlightSelectedWord': True,
        'showPrintMargin': False,
        'fontSize': "20pt"
    })
except Exception:
    from browser import html
    def get_value():
        return editor.value
    def set_value(x):
        editor.value = x
    editor = html.TEXTAREA(rows=20, cols=70)
    doc["editor"] <= editor
    editor.getValue = get_value
    editor.setValue = set_value
    has_ace = False

if hasattr(window, 'localStorage'):
    from browser.local_storage import storage
else:
    storage = None

if 'set_debug' in doc:
    __BRYTHON__.debug = int(doc['set_debug'].checked)


def reset_src():
    if storage is not None and "py_src" in storage:
        editor.setValue(storage["py_src"])
    else:
        editor.setValue('# Adapted from Jem Brown\'s Energy Consumption Data Visualization\n# 导入mb_live_chart模块\nimport mb_live_chart\n# 各国死亡人数\ntotal_deaths = [4636, 21373, 25085, 21717, 46628]\n# 各国家名称\ncontry_names = ["中国", "法国", "意大利", "西班牙", "美国"]\n# 在下面引号内填写标题，如：20200422各国新冠死亡人数对比\ntitle = "请填写图表标题"\n# 每千人表示球数，数字越高对机器性能要求越高\nballs_per_thousand = 1\n# 生成动态图表\nmb_live_chart(total_deaths, contry_names, title, balls_per_thousand)\n')
    editor.scrollToRow(0)
    editor.gotoLine(0)


def reset_src_area():
    if storage and "py_src" in storage:
        editor.value = storage["py_src"]
    else:
        editor.value = '# Adapted from Jem Brown\'s Energy Consumption Data Visualization\n# 导入mb_live_chart模块\nimport mb_live_chart\n# 各国死亡人数\ntotal_deaths = [4636, 21373, 25085, 21717, 46628]\n# 各国家名称\ncontry_names = ["中国", "法国", "意大利", "西班牙", "美国"]\n# 在下面引号内填写标题，如：20200422各国新冠死亡人数对比\ntitle = "请填写图表标题"\n# 每千人表示球数，数字越高对机器性能要求越高\nballs_per_thousand = 1\n# 生成动态图表\nmb_live_chart(total_deaths, contry_names, title, balls_per_thousand)\n'


class cOutput:

    def write(self, data):
        doc["console"].value += str(data)

    def flush(self):
        pass


if "console" in doc:
    sys.stdout = cOutput()
    sys.stderr = cOutput()


def to_str(xx):
    return str(xx)


output = ''
doc["console"].value = ''
doc.select('.open_tm_preloader')[0].classList.remove("preloader-active")
doc.select('.open_tm_preloader')[0].classList.add("loaded")


def show_console(ev):
    doc["console"].value = output
    doc["console"].cols = 60


def load_script(evt):
    _name = evt.target.value + '?foo=%s' % time.time()
    editor.setValue(open(_name).read())


def run(*args):
    global output
    doc["p5Canvas"].innerHTML = ""
    doc["console"].value = ''
    src = editor.getValue()
    if storage is not None:
        storage["py_src"] = src
    if doc["p5-mode-checkbox"].checked:
        if src.find('import mb_live_chart') >= 0:
            src = src.replace('import mb_live_chart', '')
            src = 'import random\nglobal death_amount, country_names, title, ball_amount_per_thounsand, numOfcountries, position\nballs = []\nPI = 3.1415926\ndef mb_live_chart(_death_amount, _country_names, _title, _ball_amount_per_thounsand):\n\tglobal death_amount, country_names, title, ball_amount_per_thounsand, numOfcountries, position\n\tdeath_amount = _death_amount\n\tcountry_names = _country_names\n\ttitle = _title\n\tball_amount_per_thounsand = _ball_amount_per_thounsand\n\tnumOfcountries = len(country_names)\n\tposition = [0 for _ in range(numOfcountries)]\n' + src + '\n'
            src += 'class Ball:\n\tdef __init__(self, _location, _energyLevel):\n\t\tself.location = _location\n\t\tself.ballLocation = createVector(random.uniform(90, canvasWidth - 100), random.uniform(150, canvasHeight - 70))\n\t\tself.velocity = createVector(0, 0)\n\t\tself.acceleration = createVector(0, 0)\n\t\tself.thetaRate = random.uniform(5, 10)\n\t\tself.energyLevel = _energyLevel\n\t\tself.size = 5\n\t\tself.theta = 0\n\tdef movement(self):\n\t\tself.theta += PI / self.thetaRate\n\t\tlocation0 = createVector((25 * cos(self.theta / numOfcountries) + self.location.x), (10 * sin(self.theta) + self.location.y))\n\t\tdirection = location0.sub(self.ballLocation)\n\t\tdirection.normalize()\n\t\tdirection.mult(self.energyLevel * 0.015)\n\t\tacceleration = direction\n\n\t\tself.velocity.add(acceleration)\n\t\tif self.ballLocation.dist(self.location) / canvasWidth < 0.1:\n\t\t\tself.velocity.limit(self.energyLevel * 0.15)\n\t\tself.ballLocation.add(self.velocity)\n\tdef display(self, alpha):\n\t\tturn = atan2(self.velocity.y, self.velocity.x)\n\t\tpush()\n\t\ttranslate(self.ballLocation.x, self.ballLocation.y)\n\t\trotate(turn)\n\t\tnoStroke()\n\t\tfill(self.energyLevel * 2.5, 80, 90, alpha)\n\t\tellipse(0, 0, self.size * 2, self.size / 2)\n\t\tpop()\n\t\tstroke(170, 80, 90, 10)\n\t\tline(self.ballLocation.x, self.ballLocation.y, self.location.x, self.location.y)\ndef setup():\n\tcreateCanvas(1200, 700)\n\tcolorMode(p.HSB, 360, 100, 100, 100)\n\ttextAlign(p.CENTER)\n\tbackground(0)\n\tfor i in range(numOfcountries):\n\t\tdeath_amount[i] = int(death_amount[i] / 1000 * ball_amount_per_thounsand)\n\tfor i in range(numOfcountries):\n\t\tposition[i] = canvasWidth / numOfcountries\n\t\tposition[i] += i * position[i] / 1.2\n\tfor j in range(numOfcountries):\n\t\tfor i in range(death_amount[j]):\n\t\t\tballs.append(Ball(createVector(position[j], canvasHeight / 1.1 - death_amount[j] * 4), death_amount[j]))\ndef draw():\n\tnoStroke()\n\tfill(0, 20)\n\trect(0, 0, canvasWidth, canvasHeight)\n\ttextSize(15)\n\tfor ball in balls:\n\t\tball.movement()\n\t\tball.display(70)\n\tstrokeWeight(2)\n\tstroke(360, 20)\n\tfor i in range(1, numOfcountries):\n\t\tj = i - 1\n\t\txPos1 = position[i] - (canvasWidth / numOfcountries) / 1.2\n\t\txPos2 = position[i]\n\t\tyPos1 = canvasHeight / 1.1 - death_amount[j] * 4\n\t\tyPos2 = canvasHeight / 1.1 - death_amount[i] * 4\n\t\tline(xPos1, yPos1, xPos2, yPos2)\n\tstroke(360, 10)\n\tline(position[0] * 0.5, canvasHeight / 1.1, position[-1] * 1.1, canvasHeight / 1.1)\n\tline(position[0] * 0.5, canvasHeight / 1.1, position[0] * 0.5, canvasHeight / numOfcountries)\n\tfor i in range(numOfcountries):\n\t\tfill(170, 30, 90, 70)\n\t\ttext(country_names[i], position[i], canvasHeight / 1.05)\n\tfill(200, 50, 90, 70)\n\ttextSize(20)\n\ttext(title, canvasWidth / 2, canvasHeight / 8)'

        src = src.replace('\n', '\n    ')
        src = src.replace('WEBGL', 'p.WEBGL')
        src = src.replace('frameCount', 'p.frameCount')
        src = src.replace('focused', 'p.focused')
        src = src.replace('displayWidth', 'p.displayWidth')
        src = src.replace('displayHeight', 'p.displayHeight')
        src = src.replace('windowWidth', 'p.windowWidth')
        src = src.replace('windowHeight', 'p.windowHeight')
        src = src.replace('canvasWidth', 'p.width')
        src = src.replace('canvasHeight', 'p.height')
        src = src.replace('keyIsPressed', 'p.keyIsPressed')
        src = src.replace('keyCode', 'p.keyCode')
        src = src.replace('mouseX', 'p.mouseX')
        src = src.replace('mouseY', 'p.mouseY')
        src = src.replace('mouseButton', 'p.mouseButton')
        src = src.replace('mouseIsPressed', 'p.mouseIsPressed')
        src = src.replace('touches', 'p.touches')
        src = src.replace('pixels', 'p.pixels')

        if src.find('setup()') == -1 and src.find('import mb_live_chart') == -1:
            src = src.replace('\n', '\n    ')
            src = "\n    def setup():\n        " + src + "\n    def draw():\n        pass\n"

        src = "from browser import document, window\ndef sketch(p):\n    " + src + "\n    alpha = p.alpha\n    blue = p.blue\n    brightness = p.brightness\n    color = p.color\n    green = p.green\n    hue = p.hue\n    lerpColor = p.lerpColor\n    lightness = p.lightness\n    red = p.red\n    saturation = p.saturation\n    background = p.background\n    clear = p.clear\n    colorMode = p.colorMode\n    fill = p.fill\n    noFill = p.noFill\n    noStroke = p.noStroke\n    stroke = p.stroke\n    arc = p.arc\n    ellipse = p.ellipse\n    line = p.line\n    point = p.point\n    quad = p.quad\n    rect = p.rect\n    triangle = p.triangle\n    ellipseMode = p.ellipseMode\n    noSmooth = p.noSmooth\n    rectMode = p.rectMode\n    smooth = p.smooth\n    strokeCap = p.strokeCap\n    strokeJoin = p.strokeJoin\n    strokeWeight = p.strokeWeight\n    bezier = p.bezier\n    bezierDetail = p.bezierDetail\n    bezierPoint = p.bezierPoint\n    bezierTangent = p.bezierTangent\n    curve = p.curve\n    curveDetail = p.curveDetail\n    curveTightness = p.curveTightness\n    curvePoint = p.curvePoint\n    curveTangent = p.curveTangent\n    beginContour = p.beginContour\n    beginShape = p.beginShape\n    bezierVertex = p.bezierVertex\n    curveVertex = p.curveVertex\n    endContour = p.endContour\n    endShape = p.endShape\n    quadraticVertex = p.quadraticVertex\n    vertex = p.vertex\n    loadModel = p.loadModel\n    model = p.model\n    plane = p.plane\n    box = p.box\n    sphere = p.sphere\n    cylinder = p.cylinder\n    cone = p.cone\n    ellipsoid = p.ellipsoid\n    torus = p.torus\n    remove = p.remove\n    noLoop = p.noLoop\n    loop = p.loop\n    push = p.push\n    pop = p.pop\n    redraw = p.redraw\n    fullscreen = p.fullscreen\n    pixelDensity = p.pixelDensity\n    displayDensity = p.displayDensity\n    getURL = p.getURL\n    getURLPath = p.getURLPath\n    getURLParams = p.getURLParams\n    createCanvas = p.createCanvas\n    resizeCanvas = p.resizeCanvas\n    noCanvas = p.noCanvas\n    createGraphics = p.createGraphics\n    blendMode = p.blendMode\n    applyMatrix = p.applyMatrix\n    resetMatrix = p.resetMatrix\n    rotate = p.rotate\n    rotateX = p.rotateX\n    rotateY = p.rotateY\n    rotateZ = p.rotateZ\n    scale = p.scale\n    shearX = p.shearX\n    shearY = p.shearY\n    translate = p.translate\n    createImage = p.createImage\n    saveCanvas = p.saveCanvas\n    saveFrames = p.saveFrames\n    loadImage = p.loadImage\n    image = p.image\n    tint = p.tint\n    noTint = p.noTint\n    imageMode = p.imageMode\n    blend = p.blend\n    copy = p.copy\n    filter = p.filter\n    get = p.get\n    loadPixels = p.loadPixels\n    updatePixels = p.updatePixels\n    cursor = p.cursor\n    frameRate = p.frameRate\n    noCursor = p.noCursor\n    loadJSON = p.loadJSON\n    loadStrings = p.loadStrings\n    loadTable = p.loadTable\n    loadXML = p.loadXML\n    httpGet = p.httpGet\n    httpPost = p.httpPost\n    httpDo = p.httpDo\n    createWriter = p.createWriter\n    saveJSON = p.saveJSON\n    saveStrings = p.saveStrings\n    saveTable = p.saveTable\n    downloadFile = p.downloadFile\n    day = p.day\n    hour = p.hour\n    minute = p.minute\n    millis = p.millis\n    month = p.month\n    second = p.second\n    year = p.year\n    abs = p.abs\n    ceil = p.ceil\n    constrain = p.constrain\n    dist = p.dist\n    exp = p.exp\n    floor = p.floor\n    lerp = p.lerp\n    log = p.log\n    mag = p.mag\n    map = p.map\n    max = p.max\n    min = p.min\n    norm = p.norm\n    pow = p.pow\n    round = p.round\n    sq = p.sq\n    sqrt = p.sqrt\n    createVector = p.createVector\n    noise = p.noise\n    noiseDetail = p.noiseDetail\n    noiseSeed = p.noiseSeed\n    acos = p.acos\n    asin = p.asin\n    atan = p.atan\n    atan2 = p.atan2\n    cos = p.cos\n    sin = p.sin\n    tan = p.tan\n    degrees = p.degrees\n    radians = p.radians\n    angleMode = p.angleMode\n    textAlign = p.textAlign\n    textLeading = p.textLeading\n    textSize = p.textSize\n    textStyle = p.textStyle\n    textWidth = p.textWidth\n    textAscent = p.textAscent\n    textDescent = p.textDescent\n    loadFont = p.loadFont\n    text = p.text\n    textFont = p.textFont\n    camera = p.camera\n    orbitControl = p.orbitControl\n    perspective = p.perspective\n    ortho = p.ortho\n    ambientLight = p.ambientLight\n    directionalLight = p.directionalLight\n    pointLight = p.pointLight\n    normalMaterial = p.normalMaterial\n    texture = p.texture\n    ambientMaterial = p.ambientMaterial\n    specularMaterial = p.specularMaterial\n    select = p.select\n    selectAll = p.selectAll\n    removeElements = p.removeElements\n    createDiv = p.createDiv\n    createP = p.createP\n    createSpan = p.createSpan\n    createImg = p.createImg\n    createA = p.createA\n    createSlider = p.createSlider\n    createButton = p.createButton\n    createCheckbox = p.createCheckbox\n    createSelect = p.createSelect\n    createRadio = p.createRadio\n    createInput = p.createInput\n    createFileInput = p.createFileInput\n    createVideo = p.createVideo\n    createAudio = p.createAudio\n    createCapture = p.createCapture\n    createElement = p.createElement\n    if 'preload' in locals():\n        p.preload = preload\n    if 'setup' in locals():\n        p.setup = setup\n    if 'draw' in locals():\n        p.draw = draw\n    if 'windowResized' in locals():\n        p.windowResized = windowResized\n    if 'keyPressed' in locals():\n        p.keyPressed = keyPressed\n    if 'keyReleased' in locals():\n        p.keyReleased = keyReleased\n    if 'keyTyped' in locals():\n        p.keyTyped = keyTyped\n    if 'keyIsDown' in locals():\n        p.keyIsDown = keyIsDown\n    if 'mouseMoved' in locals():\n        p.mouseMoved = mouseMoved\n    if 'mouseDragged' in locals():\n        p.mouseDragged = mouseDragged\n    if 'mousePressed' in locals():\n        p.mousePressed = mousePressed\n    if 'mouseReleased' in locals():\n        p.mouseReleased = mouseReleased\n    if 'mouseClicked' in locals():\n        p.mouseClicked = mouseClicked\n    if 'doubleClicked' in locals():\n        p.doubleClicked = doubleClicked\n    if 'mouseWheel' in locals():\n        p.mouseWheel = mouseWheel\n    if 'touchStarted' in locals():\n        p.touchStarted = touchStarted\n    if 'touchMoved' in locals():\n        p.touchMoved = touchMoved\n    if 'touchEnded' in locals():\n        p.touchEnded = touchEnded\n\nwindow.myp5 = window.p5.new(sketch, 'p5Canvas')"

    t0 = time.perf_counter()
    try:
            ns = {'__name__': '__main__'}
            exec(src, ns)
            state = 1
    except Exception as exc:
            traceback.print_exc(file=sys.stderr)
            state = 0
    output = doc["console"].value

    print('<completed in %6.2f ms>' % ((time.perf_counter() - t0) * 1000.0))
    return state


if has_ace:
        reset_src()
else:
        reset_src_area()
window.run_python = run
