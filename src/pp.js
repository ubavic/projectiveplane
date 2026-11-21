var gl
var width, height
var lambda = 1, lambdas = 1
var userCurve = { polynomial: 0, degree: 0, code: '' }
var hessianCurve = { polynomial: 0, degree: 0, code: '' }

const I = [1, 0, 0, 0, 1, 0, 0, 0, 1]
var M = [...I]

var state = {
	axis: false,
	checkerboard: true,
	triangle: true,
	level: false,
	hessian: false,
	changed: true,
	drag: [false, false, false]
}

var shaderUniformLocations = {
	level: false,
	checkerboard: null,
	hessian: null,
	axis: null,
	projectiveMatrix: null,
}

var ui = {
	canvasContainer: null,
	det: null,
	dot: [null, null, null],
	dropDown: null,
	equation: null,
	equationField: null,
}

const vertexShaderSource = `#version 300 es
	in vec4 a_position;
	void main(void) {
		gl_Position = a_position;
	}
`

const fragmentShaderSource = () => `#version 300 es
precision mediump float;

uniform int u_level;
uniform int u_hessian;
uniform int u_checkerboard;
uniform int u_axis;
uniform vec2 u_resolution;
uniform mat3 u_M;

int polynomial = 1;
vec4 grey1 = vec4(0.9, 0.9, 0.9, 1.0);
vec4 grey2 = vec4(0.6, 0.6, 0.6, 1.0);
vec4 axisGray = vec4(0.25, 0.25, 0.25, 1.0);

out vec4 outColor;

vec3 projectiveCoordinates(vec2 v) {
	float z = sqrt(1.0 - v.x * v.x - v.y * v.y);
	return vec3(v.x, v.y, z) * u_M;
}

float poly(vec3 v) {
	float p = 0.0;
	${userCurve.code}
	return p;
}

float hessian(vec3 v) {
	float p = 0.0;
	${hessianCurve.code}
	return p;
}

float p(vec2 v) {
	if (polynomial == 0)
		return poly(projectiveCoordinates(v));
	else
		return hessian(projectiveCoordinates(v));
}

vec2 grad(vec2 x) {
	vec2 h = vec2(0.01, 0);
	return vec2(p(x + h.xy) - p(x - h.xy),
	p(x + h.yx) - p(x - h.yx)) / (2.0 * h.x);
}

float color(vec2 v) {
	float s = p(v);
	vec2 g = grad(v);
	float glen = length(g);
	if (!(glen > 1e-5))
		return abs(s) > 1e-4 ? 1.0 : 0.0;
	float de = abs(s) / glen;
	float eps = 0.002;
	return smoothstep(1.0 * eps, 2.0 * eps, de);
}

float axisLine(float value, vec2 g) {
	float de = abs(value) / max(length(g), 1e-4);
	float eps = 1.0 / u_resolution.y;
	return smoothstep(eps, 2.0 * eps, de);
}

void main() {
	float t = 0.0;
	
	vec2 v = 2.0 * (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.xy;
	v.x *= u_resolution.x / u_resolution.y;
	
	if (length(v) > 1.0) {
		outColor = vec4(1.0);
		return;
	} else if (length(v) > 0.992) {
		outColor = vec4(0.0, 0.0, 0.0, 1.0);
		return;
	}
	
	vec3 s = projectiveCoordinates(v);

	if (u_checkerboard == 1 && mod(floor(s.x / s.z) + floor(s.y / s.z), 2.0) < 0.5) {
		t = 1.0 / (1.0 + pow(1.03, length(vec2(s.x / s.z, s.y / s.z))));
		outColor = mix(grey1, grey2, t);
	} else
		outColor = grey1;

	if (u_axis == 1) {
		float z = max(sqrt(max(1.0 - dot(v, v), 0.0)), 1e-4);
		vec3 dvx = vec3(1.0, 0.0, -v.x / z);
		vec3 dvy = vec3(0.0, 1.0, -v.y / z);
		float mask = 1.0;
		mask = min(mask, axisLine(s.x, vec2(dot(dvx, u_M[0]), dot(dvy, u_M[0]))));
		mask = min(mask, axisLine(s.y, vec2(dot(dvx, u_M[1]), dot(dvy, u_M[1]))));
		mask = min(mask, axisLine(s.z, vec2(dot(dvx, u_M[2]), dot(dvy, u_M[2]))));
		outColor = mix(axisGray, outColor, mask);
	}
	
	if (u_hessian == 1) {
		t = color(v);
		if (length(v) < 0.99)
			outColor = mix(vec4(0, 0 , 1, 1), outColor, t);
	}

	polynomial = 0;
	t = color(v);
	if (length(v) < 0.99)
		outColor = mix(vec4(1, 0 , 0, 1), outColor, t);

	if (u_level == 1 && abs(poly(s)) < 0.2)
		outColor = mix(vec4(1, 0 , 0, 1), outColor, 0.7);
}
`

const curves = [
	'X2+2Y2-1',				//ellipse
	'X2-Y',					//parabola
	'X2-Y2-1',				//hyperbola
	'Y2-1X3+4X',			//elliptic curve
	'Y2-X3',				//semicubical parabola
	'X3+Y3-3XY',			//folium of Descartes
	'X2Y+Y-1',				//witch of Agnesi
	'X4+2X2Y2+Y4-X2+Y2',	//lemniscate of Bernoulli
	'4X2+Y4-4Y2',			//Viviani's Curve
	'X4+2X2Y2+Y4-X3+3XY2' 	//Three-leaved clover
]

function det(M) {
	return M[0] * (M[4] * M[8] - M[5] * M[7])
		- M[1] * (M[3] * M[8] - M[5] * M[6])
		+ M[2] * (M[3] * M[7] - M[4] * M[6])
}

function inverse(M) {
	const d = det(M)
	return new Float32Array([
		(M[4] * M[8] - M[7] * M[5]) / d,
		(M[1] * M[8] - M[2] * M[7]) / -d,
		(M[1] * M[5] - M[2] * M[4]) / d,
		(M[3] * M[8] - M[5] * M[6]) / -d,
		(M[0] * M[8] - M[2] * M[6]) / d,
		(M[0] * M[5] - M[2] * M[3]) / -d,
		(M[3] * M[7] - M[4] * M[6]) / d,
		(M[0] * M[7] - M[1] * M[6]) / -d,
		(M[0] * M[4] - M[1] * M[3]) / d
	])
}

function norm(u) {
	return Math.sqrt(u[0] ** 2 + u[1] ** 2 + u[2] ** 2)
}

function simplify(p) {
	let q = []

	for (let i = 0; i < p.length; i++)
		for (let j = i + 1; j < p.length; j++)
			if (p[i].x == p[j].x && p[i].y == p[j].y && p[i].z == p[j].z) {
				p[i].c = p[i].c + p[j].c
				p[j].c = 0
			}

	let j = 0

	for (let i = 0; i < p.length; i++) {
		if (p[i].c != 0) {
			q[j++] = p[i]
		}
	}

	return q
}

function mul(p, q) {
	let t = []

	for (let i = 0; i < p.length; i++)
		for (let j = 0; j < q.length; j++)
			t[i * q.length + j] = {
				c: p[i].c * q[j].c,
				x: p[i].x + q[j].x,
				y: p[i].y + q[j].y,
				z: p[i].z + q[j].z,
			}

	return t
}

function derive(p, variable) {
	let q = []

	for (let i = 0; i < p.length; i++) {
		let e = variable == 'x' ? p[i].x : variable == 'y' ? p[i].y : variable == 'z' ? p[i].z : 0
		if (e == 0)
			continue

		q.push({
			c: p[i].c * e,
			x: p[i].x - (variable == 'x' ? 1 : 0),
			y: p[i].y - (variable == 'y' ? 1 : 0),
			z: p[i].z - (variable == 'z' ? 1 : 0),
		})
	}

	return simplify(q)
}

function scale(p, s) {
	return p.map(m => ({ ...m, c: s * m.c }))
}

function add(p, q) {
	return simplify(p.concat(q))
}

function sub(p, q) {
	return add(p, scale(q, -1))
}

function hessian(p) {
	let px = derive(p, 'x')
	let py = derive(p, 'y')
	let pz = derive(p, 'z')
	let pxx = derive(px, 'x')
	let pxy = derive(px, 'y')
	let pxz = derive(px, 'z')
	let pyy = derive(py, 'y')
	let pyz = derive(py, 'z')
	let pzz = derive(pz, 'z')

	let M1 = mul(pxx, sub(mul(pyy, pzz), mul(pyz, pyz)))
	let M2 = mul(pxy, sub(mul(pxy, pzz), mul(pxz, pyz)))
	let M3 = mul(pxz, sub(mul(pxy, pyz), mul(pyy, pxz)))

	return add(M1, sub(M3, M2))
}

function polynomialVanishes(p) {
	if (!p || p.length == 0)
		return true

	for (let i = 0; i < p.length; i++)
		if (p[i].c != 0)
			return false

	return true
}

function showHessian() {
	return state.hessian && !polynomialVanishes(hessianCurve.polynomial)
}

function homogenize(affine) {
	let p = simplify(affine.map(m => ({ c: m.c, x: m.x, y: m.y, z: 0 })))
	let degree = p.length === 0 ? 0 : Math.max(...p.map(m => m.x + m.y))

	return {
		degree: degree,
		polynomial: p.map(m => ({
			c: m.c,
			x: m.x,
			y: m.y,
			z: degree - m.x - m.y,
		})),
	}
}

function eventPoint(e) {
	if (e.touches && e.touches.length > 0)
		return e.touches[0]
	if (typeof e.clientX == 'number')
		return e
	return null
}

function placeDot(i, planeX, planeY) {
	let canvasRect = gl.canvas.getBoundingClientRect()
	let containerRect = ui.canvasContainer.getBoundingClientRect()
	let x = canvasRect.left - containerRect.left + (planeX + 1) / 2 * canvasRect.width
	let y = canvasRect.top - containerRect.top + (1 - planeY) / 2 * canvasRect.height
	let dot = ui.dot[i]

	dot.style.left = `${x - dot.offsetWidth / 2}px`
	dot.style.top = `${y - dot.offsetHeight / 2}px`
}

function createPolynomialGLSL(p) {
	const power = (coord, power) => {
		var term = ` * v.${coord}`
		return term.repeat(power)
	}

	let code = ''

	for (let i = 0; i < p.length; i++) {
		let line = `p += ${p[i].c.toFixed(5)}`
		if (p[i].x)
			line += power('x', p[i].x)
		if (p[i].y)
			line += power('y', p[i].y)
		if (p[i].z)
			line += power('z', p[i].z)

		code += line + ';\n'
	}

	return code
}

function createShader(gl, type, source) {
	const shader = gl.createShader(type)
	gl.shaderSource(shader, source)
	gl.compileShader(shader)

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.log('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader))
		gl.deleteShader(shader)
		return null
	}

	return shader
}

function createProgram(gl, vertexShader, fragmentShader) {
	const shaderProgram = gl.createProgram()
	gl.attachShader(shaderProgram, vertexShader)
	gl.attachShader(shaderProgram, fragmentShader)
	gl.linkProgram(shaderProgram)

	if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
		console.log('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram))
		return null
	}

	return shaderProgram
}

function setGL() {
	const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
	const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource())

	const shaderProgram = createProgram(gl, vertexShader, fragmentShader)

	gl.useProgram(shaderProgram)

	let triangleArray = gl.createVertexArray()
	gl.bindVertexArray(triangleArray)

	let positions = new Float32Array([
		-1, 1, 0,
		1, 1, 0,
		1, -1, 0,
		-1, -1, 0,
	])

	let positionBuffer = gl.createBuffer()
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
	gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
	gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)
	gl.enableVertexAttribArray(0)

	shaderUniformLocations.level = gl.getUniformLocation(shaderProgram, 'u_level')
	gl.uniform1i(shaderUniformLocations.level, state.level ? 1 : 0)

	shaderUniformLocations.checkerboard = gl.getUniformLocation(shaderProgram, 'u_checkerboard')
	gl.uniform1i(shaderUniformLocations.checkerboard, state.checkerboard ? 1 : 0)

	shaderUniformLocations.hessian = gl.getUniformLocation(shaderProgram, 'u_hessian')
	gl.uniform1i(shaderUniformLocations.hessian, showHessian() ? 1 : 0)

	shaderUniformLocations.axis = gl.getUniformLocation(shaderProgram, 'u_axis')
	gl.uniform1i(shaderUniformLocations.axis, state.axis ? 1 : 0)

	shaderUniformLocations.resolution = gl.getUniformLocation(shaderProgram, 'u_resolution')
	useCanvasResolution()

	shaderUniformLocations.projectiveMatrix = gl.getUniformLocation(shaderProgram, 'u_M')
	gl.uniformMatrix3fv(shaderUniformLocations.projectiveMatrix, false, inverse(M))

	gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
}


function drawLoop() {
	if (state.changed) {
		const d = det(M)

		ui.det.innerHTML = d.toFixed(2)

		if (Math.abs(d) < 0.001)
			ui.det.style.color = '#FF0000'
		else
			ui.det.style.color = '#000000'

		for (let i = 0; i < 9; i++)
			document.getElementById('i' + i).innerHTML = Number(M[i]).toFixed(2)

		gl.uniform1i(shaderUniformLocations.level, state.level ? 1 : 0)
		gl.uniform1i(shaderUniformLocations.checkerboard, state.checkerboard ? 1 : 0)
		gl.uniform1i(shaderUniformLocations.hessian, showHessian() ? 1 : 0)
		gl.uniform1i(shaderUniformLocations.axis, state.axis ? 1 : 0)
		gl.uniformMatrix3fv(shaderUniformLocations.projectiveMatrix, false, inverse(M))
		useCanvasResolution()
		gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)

		state.changed = false
	}

	window.requestAnimationFrame(drawLoop)
}

function parse(str) {
	let tokens = []

	str = str.replace(/\s+/g, '')

	if (str.length === 0)
		throw `String is empty`

	if (!'+-'.includes(str.charAt(0)))
		str = '+' + str

	while (str !== '') {
		if ('xXyY'.includes(str.charAt(0))) {
			tokens.push({ type: 'VARIABLE', value: str.charAt(0).toLowerCase() })
			str = str.slice(1)
		} else if ('+-'.includes(str.charAt(0))) {
			tokens.push({ type: 'OPERATOR', value: str.charAt(0) })
			str = str.slice(1)
		} else if ('1234567890'.includes(str.charAt(0))) {
			let digits = ''
			while (str !== '' && '1234567890'.includes(str.charAt(0))) {
				digits += str.charAt(0)
				str = str.slice(1)
			}
			tokens.push({ type: 'NUMBER', value: parseInt(digits, 10) })
		} else {
			throw `Unrecognized symbol ${str.charAt(0)}`
		}
	}

	let monomials = []

	while (tokens.length !== 0) {
		let m = []
		do {
			let token = tokens.shift()
			m.push(token)
		} while (tokens.length !== 0 && tokens[0]?.type != 'OPERATOR')

		monomials.push(m)
	}

	monomials.forEach(m => {
		if (m.length === 1)
			throw `Unexpected symbol ${m[0].value}`
	})

	let poly = monomials.map(m => {
		let c = parseInt(m[0].value + '1')
		let x = 0
		let y = 0

		if (m[1].type === 'NUMBER')
			c *= m[1].value

		for (let i = 1; i < m.length; i++) {
			const s = m[i]

			let p = 0

			if (i === m.length - 1)
				p = 1
			else if (m[i + 1]?.type === 'VARIABLE')
				p = 1
			else if (m[i + 1]?.type === 'NUMBER')
				p = m[i + 1].value
			else
				throw `Unexpected error`


			if (s.value === 'x')
				x += p
			else if (s.value === 'y')
				y += p

		}

		return ({ c: c, x: x, y: y })
	})

	return poly
}

function reset() {
	M = [...I]

	lambdas = 1

	for (let i = 0; i < 3; i++) {
		let n = norm([M[i + 0], M[i + 3], M[i + 6]])
		placeDot(i, M[i + 0] / n, M[i + 3] / n)
	}

	state.changed = true
}

function setCurve() {
	try {
		let curve = homogenize(parse(ui.equationField.value))

		userCurve.degree = curve.degree
		userCurve.polynomial = curve.polynomial

		hessianCurve.polynomial = hessian(userCurve.polynomial)
		ui.equation.innerHTML = createEquationHTML(userCurve)

		userCurve.code = createPolynomialGLSL(userCurve.polynomial)
		hessianCurve.code = createPolynomialGLSL(hessianCurve.polynomial)

		setGL()

		state.changed = true

	} catch (error) {
		ui.equation.innerHTML = `<span style='color:#F00'>${error}</span>`
	}
}

function createEquationHTML(curve) {
	let string = ''
	let substring = ''
	let p = curve.polynomial

	if (polynomialVanishes(p))
		return '0 = 0'

	for (let i = 0; i < p.length; i++) {
		if (p[i].c == 1 && (p[i].x != 0 || p[i].y != 0))
			substring = ' + '
		else if (p[i].c == -1 && (p[i].x != 0 || p[i].y != 0))
			substring = ' - '
		else if (p[i].c > 0)
			substring = ' + ' + p[i].c
		else
			substring = ' - ' + Math.abs(p[i].c)

		string = string + substring

		if (p[i].x == 0)
			substring = ''
		else if (p[i].x == 1)
			substring = '<i>x</i>'
		else
			substring = `<i>x</i><sup>${p[i].x}</sup>`

		string = string + substring

		if (p[i].y == 0)
			substring = ''
		else if (p[i].y == 1)
			substring = '<i>y</i>'
		else
			substring = `<i>y</i><sup>${p[i].y}</sup>`

		string = string + substring
	}

	if (string.charAt(1) == '+')
		string = string.substring(2)

	return string + ' = 0'
}


function switchDotColor(i) {
	ui.dot[i].classList.toggle('invertedDot')
}

function switchCoordinateTriangle() {
	for (let i = 0; i < 3; i++) {
		if (state.triangle)
			ui.dot[i].style.display = 'block'
		else
			ui.dot[i].style.display = 'none'
	}
}

function mouseUp() {
	document.body.style.cursor = 'default'
	state.drag = [false, false, false]
}

function mouseDown(i) {
	state.drag[i] = true
	document.body.style.cursor = 'grab'
	lambdas = norm([M[i + 0], M[i + 3], M[i + 6]])
}

function pointerMove(e) {
	if (!state.drag.includes(true))
		return

	if (e.cancelable)
		e.preventDefault()

	let point = eventPoint(e)
	if (!point)
		return

	let rect = gl.canvas.getBoundingClientRect()
	let x = ((point.clientX - rect.left) / rect.width) * 2 - 1
	let y = 1 - ((point.clientY - rect.top) / rect.height) * 2

	for (let i = 0; i < 3; i++) {
		if (state.drag[i]) {
			let sign = (M[i + 6] >= 0) ? 1 : -1
			if (x ** 2 + y ** 2 <= 1) {
				M[i + 0] = lambdas * x
				M[i + 3] = lambdas * y
				M[i + 6] = sign * lambdas * Math.sqrt(1 - x ** 2 - y ** 2)
			} else {
				M[i + 0] = lambdas * x / Math.sqrt(x ** 2 + y ** 2)
				M[i + 3] = lambdas * y / Math.sqrt(x ** 2 + y ** 2)
				M[i + 6] = sign * lambdas * 0
			}

			let n = norm([M[i + 0], M[i + 3], M[i + 6]])
			placeDot(i, M[i + 0] / n, M[i + 3] / n)
			state.changed = true
			break
		}
	}
}


function useCanvasResolution() {
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
	if (shaderUniformLocations.resolution)
		gl.uniform2f(shaderUniformLocations.resolution, gl.canvas.width, gl.canvas.height)
}

function resizeCanvas() {
	let cvs = gl.canvas
	let cssSize = cvs.getBoundingClientRect().width
	if (cssSize <= 0)
		return

	let ratio = window.devicePixelRatio || 1
	let buffer = Math.max(1, Math.round(cssSize * ratio))

	if (cvs.width !== buffer || cvs.height !== buffer) {
		cvs.width = buffer
		cvs.height = buffer
		width = buffer
		height = buffer
		state.changed = true
	}

	if (!ui.dot[0])
		return

	for (let i = 0; i < 3; i++) {
		let n = norm([M[i + 0], M[i + 3], M[i + 6]])
		placeDot(i, M[i + 0] / n, M[i + 3] / n)
	}
}

var pixelRatioQuery = null

function onPixelRatioChange() {
	resizeCanvas()
	watchPixelRatio()
}

function watchPixelRatio() {
	if (pixelRatioQuery)
		pixelRatioQuery.removeEventListener('change', onPixelRatioChange)

	pixelRatioQuery = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`)
	pixelRatioQuery.addEventListener('change', onPixelRatioChange)
}

function setup() {
	const cvs = document.getElementById('canvas')
	gl = cvs.getContext('webgl2')

	if (!gl) {
		console.log('Unable to initialize WebGL. Your browser or machine may not support it.')
		return
	}

	ui.canvasContainer = document.getElementById('canvasContainer')

	for (let i = 0; i < 3; i++) {
		ui.dot[i] = document.getElementById('dot' + i)

		ui.dot[i].addEventListener('mousedown', () => { mouseDown(i) })
		ui.dot[i].addEventListener('touchstart', (e) => {
			e.preventDefault()
			mouseDown(i)
		}, { passive: false })
		ui.dot[i].addEventListener('contextmenu', (e) => { e.preventDefault() })

		ui.dot[i].ondblclick = () => {
			M[i + 6] = -1 * M[i + 6]
			state.changed = true
			switchDotColor(i)
		}

		ui.dot[i].onwheel = (e) => {
			e.preventDefault()

			if (e.deltaY < 0)
				lambda = 1.1
			else
				lambda = 0.9

			M[i + 0] = lambda * M[i + 0]
			M[i + 3] = lambda * M[i + 3]
			M[i + 6] = lambda * M[i + 6]
			state.changed = true
		}
	}

	resizeCanvas()

	document.addEventListener('mouseup', mouseUp)
	document.addEventListener('touchend', mouseUp)
	document.addEventListener('touchcancel', mouseUp)
	document.addEventListener('mousemove', pointerMove)
	document.addEventListener('touchmove', pointerMove, { passive: false })

	document.getElementById('checkboxTriangle').checked = state.triangle
	document.getElementById('checkboxAxis').checked = state.axis
	document.getElementById('checkboxLevel').checked = state.level
	document.getElementById('checkboxCheckerboard').checked = state.checkerboard
	document.getElementById('checkboxHessian').checked = state.hessian

	ui.det = document.getElementById('det')
	ui.dropDown = document.getElementById('equationDropDown')
	ui.equation = document.getElementById('equation')
	ui.equationField = document.getElementById('equationField')

	ui.dropDown.value = 0
	ui.equationField.value = curves[0]
	setCurve()

	ui.equationField.oninput = () => {
		ui.dropDown.value = 20
		setCurve()
	}

	ui.dropDown.onchange = () => {
		if (ui.dropDown.value != 20) {
			ui.equationField.value = curves[ui.dropDown.value]
			setCurve()
		}
	}

	setGL()
	new ResizeObserver(() => resizeCanvas()).observe(ui.canvasContainer)
	watchPixelRatio()
	window.requestAnimationFrame(drawLoop)
}
