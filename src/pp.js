var ctx;
var width, height;
var zoom = 0.9;
var changed = true;
var lambda = 1, lambdas = 1;
var pasukon;
var userCurve = {polynomial: 0, degree: 0}, hessianCurve = {polynomial: 0, degree: 0};
var equationField, equationDiv, equationDropDown;
var points = {xdrag : false, ydrag : false, zdrag : false};
var drag = [false, false, false]; 
var options = {axis : true, chessboard: true, triangle : true, level : false, hessian: false};
var M =[1, 0, 0, 0, 1, 0, 0, 0, 1];
var Mi;
var I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
var A = [], H = [];

curves = [
	"X2+2Y2+-1",			//elipse
	"X2+-1Y",				//parabola
	"X2+-1Y2+-1",			//hyperbola
	"Y2+-1X3+4X",			//eliptic
	"Y2+-1X3",				//semicubical parabola
	"X3+Y3+-3XY",			//folium of Descartes
	"X2Y+Y+-1",				//witch of Agnesi
	"X4+2X2Y2+Y4+-1X2+Y2",	//lemniscate of Bernoulli
	"4X2+Y4+-4Y2",			//Viviani's Curve
	"X4+2X2Y2+Y4+-1X3+3XY2" //Three-leaved clover
];


function ToCanvasCoordinates (x, y) {
	return {w: width * (zoom * x + 1) / 2, h : height * (1 - zoom*y) / 2 };
}

function ToPlaneCoordinates (w, h) {
	return {x: ((w / width) * 2 - 1) / zoom, y: (1 - (h / height) * 2) / zoom };
}

function ToProjectiveCoordinates (x, y) {
	var z = Math.sqrt(1 - x**2 - y**2);
	return {X : Mi[0]*x + Mi[1]*y + Mi[2]*z,
			Y : Mi[3]*x + Mi[4]*y + Mi[5]*z,
			Z : Mi[6]*x + Mi[7]*y + Mi[8]*z}
}

function Det (M) {
	return (M[0]*(M[4]*M[8]-M[5]*M[7]) - M[1]*(M[3]*M[8]-M[5]*M[6]) + M[2]*(M[3]*M[7]-M[4]*M[6]));
}

function Inverse (M) {
	det = Det(M);
	return [   (M[4]*M[8] - M[7]*M[5])/det, -1*(M[1]*M[8] - M[2]*M[7])/det,    (M[1]*M[5] - M[2]*M[4])/det,
			-1*(M[3]*M[8] - M[5]*M[6])/det,    (M[0]*M[8] - M[2]*M[6])/det, -1*(M[0]*M[5] - M[2]*M[3])/det,
			   (M[3]*M[7] - M[4]*M[6])/det, -1*(M[0]*M[7] - M[1]*M[6])/det,    (M[0]*M[4] - M[1]*M[3])/det];
}

function Norm(u) {
	return Math.sqrt(u[0]**2 + u[1]**2 + u[2]**2);
}

function VectorProduct (u, v) {
	return [u[1]*v[2] - u[2]*v[1], u[2]*v[0] - u[0]*v[2], u[0]*v[1] - u[1]*v[0]];
}

function polynomialEval (p, X, Y, Z) {
	var result = 0;

	for (var i = 0; i < p.length; i++) {
		result = result + p[i].c * (X ** p[i].xp) * (Y ** p[i].yp) * (Z ** p[i].zp);
	}

	return result;
}

function SimplifyPolynomial (p) {
	var i, j;
	var q = [];

	for (i = 0; i < p.length; i++) {
		for (j = i + 1; j < p.length; j++) {
			if (p[i].xp == p[j].xp && p[i].yp == p[j].yp && p[i].zp == p[j].zp) {
				p[i].c = p[i].c + p[j].c;
				p[j].c = 0;
			}
		}
	}

	var q;
	j = 0;

	for (i = 0; i < p.length; i++) {
		if (p[i].c != 0){
			q[j++] = p[i];
		}
	}

	return q;
}

function MultiplePolynomials (p, q) {
	var i, j;
	var t = [];

	for (i = 0; i < p.length; i++) {
		for (j = 0; j < q.length; j++) {
			t[i * q.length + j] = {	xp: p[i].xp + q[j].xp,
								  	yp: p[i].yp + q[j].yp,
								  	zp: p[i].zp + q[j].zp,
									c: p[i].c * q[j].c };
		}
	}

	return t;
}


function DerivePolynomial (p, variable) {
	var q = [];

	if (variable == "x" || variable == "X") {
		for (var i = 0; i < p.length; i++) {
			q[i] = {xp: (p[i].xp - 1), yp: p[i].yp, zp: p[i].zp, c: (p[i].c * p[i].xp)};
		}
	} else if (variable == "y" || variable == "Y") {
		for (var i = 0; i < p.length; i++) {
			q[i] = {xp: p[i].xp, yp: (p[i].yp - 1), zp: p[i].zp, c: (p[i].c * p[i].yp)};
		}
	} else {
		for (var i = 0; i < p.length; i++) {
			q[i] = {xp: p[i].xp, yp: p[i].yp, zp: (p[i].zp - 1), c: (p[i].c * p[i].zp)};
		}
	}

	for (var i = 0; i < q.length; i++) {
		if ((q[i].xp + 1) *(q[i].yp + 1) * (q[i].zp + 1) == 0) {
			q[i] = {xp: 0, yp: 0, zp: 0, c: 0};
		}
	}

	return SimplifyPolynomial(q);
}


function ScalePolynomial (p, lambda) {
	var q = [];

	for (var i = 0; i < p.length; i++) {
		q[i] = {xp: p[i].xp, yp: p[i].yp, zp: p[i].zp, c: lambda * p[i].c};
	}

	return q;
}


function AddPolynomials (p, q) {
	return SimplifyPolynomial (p.concat(q));
}

function SubPolynomials (p, q) {
	return AddPolynomials (p, ScalePolynomial(q, -1));
}


function Hessian (p) {
	var px = DerivePolynomial(p, "x");
	var py = DerivePolynomial(p, "y");
	var pz = DerivePolynomial(p, "z");
	var pxx = DerivePolynomial(px, "x");
	var pxy = DerivePolynomial(px, "y");
	var pxz = DerivePolynomial(px, "z");
	var pyy = DerivePolynomial(py, "y");
	var pyz = DerivePolynomial(py, "z");
	var pzz = DerivePolynomial(pz, "z");

	var M1 = MultiplePolynomials(pxx, SubPolynomials(MultiplePolynomials(pyy, pzz), MultiplePolynomials(pyz, pyz)));
	var M2 = MultiplePolynomials(pxy, SubPolynomials(MultiplePolynomials(pxy, pzz), MultiplePolynomials(pxz, pyz)));
	var M3 = MultiplePolynomials(pxz, SubPolynomials(MultiplePolynomials(pxy, pyz), MultiplePolynomials(pyy, pxz)));

	return AddPolynomials(M1, SubPolynomials(M3, M2));
}


function Draw () {
	var coordinates, norm, c;
	ctx.clearRect(0, 0, width, height);

	ctx.fillStyle ="#EEEEEE";
	ctx.strokeStyle = "#000000";
	ctx.lineWidth = 4;
	ctx.beginPath();
	ctx.arc(width/2, height/2, width*zoom/2, 0, 2 * Math.PI);
	ctx.stroke();
	ctx.fill();

	ctx.fillStyle ="#CCCCCC";
	for (var i = 0; i < width; i++) {
		for (var j = 0; j < height; j++) {
			coordinates = ToPlaneCoordinates(i, j);
			if (coordinates.x**2 + coordinates.y**2 < 1) {
				c = ToProjectiveCoordinates (coordinates.x, coordinates.y);
				A[i * width + j] = polynomialEval(userCurve.polynomial, c.X, c.Y, c.Z);
				H[i * width + j] = polynomialEval(hessianCurve.polynomial, c.X, c.Y, c.Z);

				if (options.chessboard == true && (Math.floor(c.X/c.Z) + Math.floor(c.Y/c.Z)) % 2 == 0) {
					ctx.fillRect(i, j, 1, 1);
				}
			}
		}
	}

	if(options.hessian){
		ctx.fillStyle ="#0033FF";
		for (var i = 1; i < width - 1; i++) {
			for (var j = 1; j < height -1; j++) {
				if (Math.abs(H [i * width + j]) < 1000 && (H [(i-1) * width + j] * H [(i+1) * width + j] < 0 || H [i * width + j - 1] * H [i * width + j + 1] < 0)) {
					ctx.fillRect(i, j, 1, 1);
				}
			}
		}
	}

	ctx.fillStyle ="#FF0000";
	for (var i = 1; i < width - 1; i++) {
		for (var j = 1; j < height -1; j++) {
			if (Math.abs(A [i * width + j]) < 1000 && (A [(i-1) * width + j] * A [(i+1) * width + j] < 0 || A [i * width + j - 1] * A [i * width + j + 1] < 0)) {
				ctx.fillRect(i, j, 1, 1);
				continue;
			}
			if (options.level && Math.abs(A [i* width + j]) < 0.1) {
				ctx.fillStyle ="#DD999966";
				ctx.fillRect(i, j, 1, 1);
				ctx.fillStyle ="#FF0000"
			}
		}
	}
}


function drawLoop() {
	if (changed){
		Mi = Inverse(M);

		det = Det(M).toFixed(4);
		document.getElementById("det").innerHTML = det;
		if (Math.abs(det)<0.001) {
			document.getElementById("det").style.color = "#FF0000";
		} else {
			document.getElementById("det").style.color = "#000000";
		}

		Draw();
		changed = false;
	
		for (i = 0; i < 9; i++){
			 document.getElementById('i'+i).innerHTML = Number(M[i]).toFixed(2);
		}
	}

	window.requestAnimationFrame(drawLoop);
}


function Setup () {
	var cvs = document.getElementById("canvas");
	ctx = cvs.getContext("2d");

	cvs.width = cvs.getBoundingClientRect().width;
	cvs.height = cvs.getBoundingClientRect().width;

	width = cvs.width;
	height = cvs.height;

	for (let i = 0; i < 3; i++) {
		let dot = document.getElementById("dot" + i);
		
		var norm = Norm([M[i + 0], M[i + 3], M[i + 6]]);
		var coordinates = ToCanvasCoordinates(M[i + 0] / norm, M[i + 3] / norm);

		dot.style.top = (coordinates.h - 3) + "px";
		dot.style.left = (coordinates.w - 3) + "px";

		dot.onmousedown = function (e) {
			drag[i] = true;
			document.body.style.cursor = "grab";
			lambdas = Norm([M[i + 0], M[i + 3], M[i + 6]]);;
		};

		dot.ondblclick = function (e) {
			M[i + 6] = -1 * M[i + 6];
			changed = true;
			SwitchDotColor(i);
		}

		dot.onwheel = function (e) {
			e.preventDefault();

			if (event.deltaY < 0) {
				lambda = 1.1
			} else {
				lambda = 0.9;
			}
	
			M[i + 0] = lambda * M[i + 0];
			M[i + 3] = lambda * M[i + 3];
			M[i + 6] = lambda * M[i + 6];
			changed = true;
		};
	}

	document.getElementById("canvasContainer").onmouseup = function (e) {
		document.body.style.cursor = "default";
		drag[0] = false;
		drag[1] = false;
		drag[2] = false;
	};

	document.getElementById("canvas").onmousemove = function (e) {

		var x = e.pageX - document.getElementById("canvasContainer").offsetLeft;
		var y = e.pageY - document.getElementById("canvasContainer").offsetTop;
		var coordinates = ToPlaneCoordinates(x, y);

		for (var i = 0; i < 3; i++){
			if (drag [i]) {
				var sign = (M[i + 6] >= 0) ? 1 : -1;
				if (coordinates.x**2 + coordinates.y**2 <= 1){
	 				M[i + 0] = lambdas * coordinates.x;
	 				M[i + 3] = lambdas * coordinates.y;
	 				M[i + 6] = sign * lambdas * Math.sqrt(1 - coordinates.x**2 - coordinates.y**2);
	 			} else {
	 				M[i + 0] = lambdas * coordinates.x / Math.sqrt(coordinates.x**2 + coordinates.y**2);
	 				M[i + 3] = lambdas * coordinates.y / Math.sqrt(coordinates.x**2 + coordinates.y**2);
	 				M[i + 6] = sign * lambdas * 0;
	 			}
	
				var norm = Norm([M[i + 0], M[i + 3], M[i + 6]]);
				coordinates = ToCanvasCoordinates(M[i + 0] / norm, M[i + 3] / norm);
				document.getElementById("dot" + i).style.left = (coordinates.w- 3) + "px";
				document.getElementById("dot" + i).style.top = (coordinates.h - 3) + "px";
	 			changed = true;
	 			break;
	 		}
		}
	}

	document.getElementById("checkboxTriangle").checked = options.triangle;
	document.getElementById("checkboxLevel").checked = options.level;
	document.getElementById("checkboxChessboard").checked = options.chessboard;
	document.getElementById("checkboxHessian").checked = options.hessian;

	equationField = document.getElementById("equationField")
	equationDropDown = document.getElementById("equationDropDown");
	equationDiv = document.getElementById("equationDiv");

	pasukon = new Pasukon(grammar);
	equationDropDown.value = 0;
	equationField.value = curves[0];
	Parse();

	equationField.oninput = function(e) {
		equationDropDown.value = 20;
		Parse();
	};

	equationDropDown.onchange = function(e) {
		if (equationDropDown.value != 20) {
			equationField.value = curves[equationDropDown.value];
			Parse();
		}
	}

	window.requestAnimationFrame(drawLoop);
}

function ResetTransformation () {
	M = I.slice();
	lambdas = 1;

	for (var i = 0; i < 3; i++) {
		var norm = Norm([M[i + 0], M[i + 3], M[i + 6]]);
		coordinates = ToCanvasCoordinates(M[i + 0] / norm, M[i + 3] / norm);
		document.getElementById("dot" + i).style.left = (coordinates.w - 3) + "px";
		document.getElementById("dot" + i).style.top = (coordinates.h - 3) + "px";
	}

	changed = true;
}

function SaveImage () {
	var cvs = document.getElementById("canvas");
	var image = cvs.toDataURL("image/png").replace("image/png", "image/octet-stream");
	window.location.href=image;
}

function ParsePolynomial (str) {
	var error = false;
	var errorStr;
	var p = [];

	try {
		p = pasukon.parse(str);
	} catch (errorStr) {
		throw errorStr;
	}

	for (var i = 0; i < p.length; i++) {
		if (p[i].c == null) {p[i].c = 1;}
		if (p[i].xp == null) {p[i].xp = 0;}
		if (p[i].yp == null) {p[i].yp = 0;}
		if (p[i].zp == null) {p[i].zp = 0;}
	}

	return p;
}

function Parse () {	
	var error = false;
	var eq1;
	userCurve.degree = 0;

	try {
		p = ParsePolynomial(equationField.value);
	} catch (error) {
		equationDiv.innerHTML = "<span style='color:#F00'>" + error + "</span>";
		error = true;
	}

	for (var i = 0; i < p.length; i++) {
		userCurve.degree = Math.max(userCurve.degree, p[i].xp + p[i].yp); 
	}

	for (var i = 0; i < p.length; i++) {
		p[i].zp = userCurve.degree - p[i].xp - p[i].yp;
	}

	userCurve.polynomial = p;
	hessianCurve.polynomial = Hessian(userCurve.polynomial);
	equationDiv.innerHTML = CreateEquationHTML(userCurve);
	changed = true;

}

function CreateEquationHTML (curve) {
	var string = "";
	var substring = "";
	var p = curve.polynomial;

	for (var i = 0; i < p.length; i++) {
		if (p[i].c == 1 && (p[i].xp != 0 || p[i].yp !=0)){
			substring = " + ";
		} else if (p[i].c == -1 && (p[i].xp != 0 || p[i].yp !=0)) {
			substring = " - ";
		} else if (p[i].c > 0) {
			substring = " + " + p[i].c; 
		} else {
			substring = " - " + Math.abs(p[i].c);
		}

		string = string + substring;

		if (p[i].xp == 0){
			substring = ""
		} else if (p[i].xp == 1) {
			substring = "<i>x</i>"; 
		} else {
			substring = "<i>x</i><sup>" + p[i].xp + "</sup>";
		}

		string = string + substring;

		if (p[i].yp == 0){
			substring = ""
		} else if (p[i].yp == 1) {
			substring = "<i>y</i>"; 
		} else {
			substring = "<i>y</i><sup>" + p[i].yp + "</sup>";
		}

		string = string + substring;
	}

	if (string.charAt(1) == '+'){
		string = string.substring(2);
	}

	return string + " = 0";
}


function SwitchDotColor(i) {
	let dot = document.getElementById("dot" + i);

	if(dot.classList.contains('invertedDot')){
		dot.classList.remove('invertedDot');
	} else {
		dot.classList.add('invertedDot');
	}	
}

function SwitchCoordinateTriangle() {
	for (var i = 0; i < 3; i++) {
		let dot = document.getElementById("dot" + i);

		if (!options.triangle)
			dot.style.display = "none";
		else
			dot.style.display = "block";
	}
}
