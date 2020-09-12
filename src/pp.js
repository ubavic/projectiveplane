var ctx;
var width, height;
var zoom = 0.9;
var changed = true;
var lambda = 1;
var lambdas = [1, 1 , 1];
var pasukon;
var eq, degree;
var equationField, equationDiv, equationDropDown;
var points = {xdrag : false, ydrag : false, zdrag : false};
var drag = [false, false, false]; 
options = {axis : true, triangle : true, level : false };
var M =[1, 0, 0, 0, 1, 0, 0, 0, 1];
var Mi;
var I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
var A = [];

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
			   (M[3]*M[5] - M[4]*M[6])/det, -1*(M[0]*M[7] - M[1]*M[6])/det,    (M[0]*M[4] - M[1]*M[3])/det];
}

function Norm(u) {
	return Math.sqrt(u[0]**2 + u[1]**2 + u[2]**2);
}

function VectorProduct (u, v) {
	return [u[1]*v[2] - u[2]*v[1], u[2]*v[0] - u[0]*v[2], u[0]*v[1] - u[1]*v[0]];
}

function polynomialEval (x, y) {
	var c = ToProjectiveCoordinates (x, y);
	var result = 0;

	for (var i = 0; i < eq.length; i++) {
		result = result + eq[i].c * (c.X ** eq[i].xp) * (c.Y ** eq[i].yp) * (c.Z ** (degree - eq[i].xp - eq[i].yp));
	}

	return result;
}

function Draw () {
	var coordinates, norm;
	ctx.clearRect(0, 0, width, height);

	ctx.fillStyle ="#EEEEEE";
	ctx.strokeStyle = "#000000";
	ctx.lineWidth = 4;
	ctx.beginPath();
	ctx.arc(width/2, height/2, width*zoom/2, 0, 2 * Math.PI);
	ctx.stroke();
	ctx.fill();

	for (var i = 0; i < width; i++) {
		for (var j = 0; j < height; j++) {
			coordinates = ToPlaneCoordinates(i, j);
			if (coordinates.x**2 + coordinates.y**2 < 1) {
				A[i * width + j] = polynomialEval(coordinates.x, coordinates.y);
			}

			coordinates2 = ToProjectiveCoordinates(coordinates.x, coordinates.y)
			if ( (Math.floor(coordinates2.X/coordinates2.Z) + Math.floor(coordinates2.Y/coordinates2.Z)) % 2 == 0) {
				ctx.fillStyle ="#CCCCCC";
				ctx.fillRect(i, j, 1, 1);
			}

		}
	}

	ctx.fillStyle ="#FF0000";
	for (var i = 1; i < width - 1; i++) {
		for (var j = 1; j < height -1; j++) {
			if (options.level && A [i* width + j] < 0.1 && A [i* width + j] > - 0.1) {
				ctx.fillStyle ="#CCCCCC";
				ctx.fillRect(i, j, 1, 1);
				ctx.fillStyle ="#FF0000";
			}
			if (Math.abs(A [i * width + j]) < 1 && (A [(i-1) * width + j] * A [(i+1) * width + j] < 0 || A [i * width + j - 1] * A [i * width + j + 1] < 0)) {
				ctx.fillRect(i, j, 1, 1);
			}
		}
	}


	//if (options.axis) {
		//uictx.beginPath();
		//coordinates = ToCanvasCoordinates(M[1], M[4]);
		//uictx.moveTo(coordinates.w, coordinates.h);
		//for (i = 0; i < 2*Math.PI; i = i + 0.1){
		//	coordinates = ToCanvasCoordinates(M[1]*Math.cos(i) + M[2]*Math.sin(i), M[4]*Math.cos(i) + M[5]*Math.sin(i));
		//	uictx.lineTo(coordinates.w, coordinates.h);
		//}
		//uictx.stroke();
	//}
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
			lambdas[i] = Norm([M[i + 0], M[i + 3], M[i + 6]]);;
		};


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

		if (drag [0]) {
			if (coordinates.x**2 + coordinates.y**2 <= 1){
	 			M[0] = lambdas[0] * coordinates.x;
	 			M[3] = lambdas[0] * coordinates.y;
	 			M[6] = lambdas[0] * Math.sqrt(1 - coordinates.x**2 - coordinates.y**2);
	 		} else {
	 			M[0] = lambdas[0] * coordinates.x / Math.sqrt(coordinates.x**2 + coordinates.y**2);
	 			M[3] = lambdas[0] * coordinates.y / Math.sqrt(coordinates.x**2 + coordinates.y**2);
	 			M[6] = lambdas[0] * 0;
	 		}
	
			var norm = Norm([M[0], M[3], M[6]]);
			coordinates = ToCanvasCoordinates(M[0] / norm, M[3] / norm);
			document.getElementById("dot0").style.left = (coordinates.w- 3) + "px";
			document.getElementById("dot0").style.top = (coordinates.h - 3) + "px";

	 		changed = true;


	 	} else if (drag [1]) {
			if (coordinates.x**2 + coordinates.y**2 <= 1){
	 			M[1] = lambdas[1] * coordinates.x;
	 			M[4] = lambdas[1] * coordinates.y;
	 			M[7] = lambdas[1] * Math.sqrt(1 - coordinates.x**2 - coordinates.y**2);
	 		} else {
	 			M[1] = lambdas[1] * coordinates.x / Math.sqrt(coordinates.x**2 + coordinates.y**2);
	 			M[4] = lambdas[1] * coordinates.y / Math.sqrt(coordinates.x**2 + coordinates.y**2);
	 			M[7] = lambdas[1] * 0;
	 		}
	 		var norm = Norm([M[1], M[4], M[7]]);
			coordinates = ToCanvasCoordinates(M[1] / norm, M[4] / norm);
			document.getElementById("dot1").style.left = (coordinates.w - 3) + "px";
			document.getElementById("dot1").style.top = (coordinates.h - 3) + "px";

	 		changed = true;
	 	} else if (drag [2]) {
			if (coordinates.x**2 + coordinates.y**2 <= 1){
	 			M[2] = lambdas[2] * coordinates.x;
				M[5] = lambdas[2] * coordinates.y;
	 			M[8] = lambdas[2] * Math.sqrt(1 - coordinates.x**2 - coordinates.y**2);
	 		} else {
	 			M[2] = lambdas[2] * coordinates.x / Math.sqrt(coordinates.x**2 + coordinates.y**2);
	 			M[5] = lambdas[2] * coordinates.y / Math.sqrt(coordinates.x**2 + coordinates.y**2);
	 			M[8] = lambdas[2] * 0;
	 		}
	 		var norm = Norm([M[2], M[5], M[8]]);
			coordinates = ToCanvasCoordinates(M[2] / norm, M[5] / norm);
			document.getElementById("dot2").style.left = (coordinates.w - 3) + "px";
			document.getElementById("dot2").style.top = (coordinates.h - 3) + "px";

	 		changed = true;
	 	}

	}

	//document.getElementById("checkboxAxis").checked = options.axis;
	document.getElementById("checkboxTriangle").checked = options.triangle;
	document.getElementById("checkboxLevel").checked = options.level;

	equationField = document.getElementById("equationField")
	equationDropDown = document.getElementById("equationDropDown");
	equationDiv = document.getElementById("equationDiv");

	pasukon = new Pasukon(grammar);
	equationDropDown.value = 0;
	equationField.value = curves[0];
	degree = 0;
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
	lambdas[0] = 1;
	lambdas[1] = 1;
	lambdas[2] = 1;
	changed = true;
}

function SaveImage () {
	var cvs = document.getElementById("canvas");
	var image = cvs.toDataURL("image/png").replace("image/png", "image/octet-stream");
	window.location.href=image;
}

function Parse () {	
	var error = false;
	var eq1;
	degree = 0;

	try {
		eq1 = pasukon.parse(equationField.value);

	} catch (error) {
		equationDiv.innerHTML = "<span style='color:#F00'>" + error + "</span>";
		error = true;
	}

	if (!error) {
		for (var i = 0; i < eq1.length; i++) {
			if (eq1[i].c == null) {eq1[i].c = 1;}
			if (eq1[i].xp == null) {eq1[i].xp = 0;}
			if (eq1[i].yp == null) {eq1[i].yp = 0;}
			degree = Math.max(degree, eq1[i].xp + eq1[i].yp);
		}

		eq = eq1;
		equationDiv.innerHTML = CreateEquationHTML ();

		changed = true;
	}
}

function CreateEquationHTML () {
	var string = "";
	var substring = "";

	for (var i = 0; i < eq.length; i++) {
		if (eq[i].c == 1 && (eq[i].xp != 0 || eq[i].yp !=0)){
			substring = " + ";
		} else if (eq[i].c == -1 && (eq[i].xp != 0 || eq[i].yp !=0)) {
			substring = " - ";
		} else if (eq[i].c > 0) {
			substring = " + " + eq[i].c; 
		} else {
			substring = " - " + Math.abs(eq[i].c);
		}

		string = string + substring;

		if (eq[i].xp == 0){
			substring = ""
		} else if (eq[i].xp == 1) {
			substring = "X"; 
		} else {
			substring = "X<sup>" + eq[i].xp + "</sup>";
		}

		string = string + substring;

		if (eq[i].yp == 0){
			substring = ""
		} else if (eq[i].yp == 1) {
			substring = "Y"; 
		} else {
			substring = "Y<sup>" + eq[i].yp + "</sup>";
		}

		string = string + substring;
	}

	return "<span style='font-family:Georgia, serif'>" + string + " = 0</span>";
}