var svg = document.querySelector("svg");
var cursor = svg.createSVGPoint();
var arrows = document.querySelector(".arrows");
var randomAngle = 0;

// Center of target
var target = {
	x: 900,
	y: 249.5
};

// Target intersection line segment
var lineSegment = {
	x1: 875,
	y1: 280,
	x2: 925,
	y2: 220
};

// Bow rotation point
var pivot = {
	x: 100,
	y: 250
};

// Drag tracking variables for Slingshot mode
var isDragging = false;
var dragStart = { x: 0, y: 0 };

svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

// Global touch / pointer listeners on window for anywhere-on-screen touch
window.addEventListener("pointerdown", startDrag);
window.addEventListener("touchstart", startDrag, { passive: false });

function startDrag(e) {
	if (e.cancelable) e.preventDefault();

	var point = getMouseSVG(e);
	if (!point) return;

	isDragging = true;
	dragStart.x = point.x;
	dragStart.y = point.y;

	randomAngle = (Math.random() * Math.PI * 0.03) - 0.015;
	TweenMax.set(".arrow-angle use", {
		opacity: 1
	});

	window.addEventListener("pointermove", aim, { passive: false });
	window.addEventListener("touchmove", aim, { passive: false });
	window.addEventListener("pointerup", loose);
	window.addEventListener("touchend", loose);
	
	aim(e);
}

function aim(e) {
	if (!isDragging) return;
	if (e.cancelable) e.preventDefault();

	var currentPoint = getMouseSVG(e);
	if (!currentPoint) return;

	// Calculate drag delta from initial touch point
	var dragDx = currentPoint.x - dragStart.x;
	var dragDy = currentPoint.y - dragStart.y;

	// Invert direction for Slingshot feel (Pulling down/left aims up/right)
	var dx = -dragDx;
	var dy = -dragDy;

	// Prevent aim snap when touch barely moves
	if (Math.abs(dx) < 2 && Math.abs(dy) < 2) {
		dx = -1;
		dy = 0;
	}

	// Calculate angle based on pull vector
	var angle = Math.atan2(dy, dx) + randomAngle;
	var bowAngle = angle;
	
	// Power / draw distance based on total drag distance
	var dragDistance = Math.sqrt((dragDx * dragDx) + (dragDy * dragDy));
	var distance = Math.min(dragDistance, 50);
	var scale = Math.min(Math.max(distance / 30, 1), 2);
	
	// Immediate position tracking without motion lag
	TweenMax.set("#bow", {
		scaleX: scale,
		rotation: bowAngle + "rad",
		transformOrigin: "right center"
	});

	TweenMax.set(".arrow-angle", {
		rotation: bowAngle + "rad",
		svgOrigin: "100 250"
	});
	
	TweenMax.set(".arrow-angle use", {
		x: -distance
	});
	
	TweenMax.set("#bow polyline", {
		attr: {
			points: "88,200 " + Math.min(pivot.x - ((1 / scale) * distance), 88) + ",250 88,300"
		}
	});

	var radius = distance * 9;
	var offset = {
		x: (Math.cos(bowAngle) * radius),
		y: (Math.sin(bowAngle) * radius)
	};
	var arcWidth = offset.x * 3;

	TweenMax.set("#arc", {
		attr: {
			d: "M100,250c" + offset.x + "," + offset.y + "," + (arcWidth - offset.x) + "," + (offset.y + 50) + "," + arcWidth + ",50"
		},
		autoAlpha: distance / 60
	});
}

function loose(e) {
	if (!isDragging) return;
	isDragging = false;

	window.removeEventListener("pointermove", aim);
	window.removeEventListener("touchmove", aim);
	window.removeEventListener("pointerup", loose);
	window.removeEventListener("touchend", loose);

	// Snap bow back
	TweenMax.to("#bow", 0.3, {
		scaleX: 1,
		transformOrigin: "right center",
		ease: Elastic.easeOut
	});
	TweenMax.to("#bow polyline", 0.3, {
		attr: {
			points: "88,200 88,250 88,300"
		},
		ease: Elastic.easeOut
	});

	// Fire arrow
	var newArrow = document.createElementNS("http://www.w3.org/2000/svg", "use");
	newArrow.setAttributeNS('http://www.w3.org/1999/xlink', 'href', "#arrow");
	arrows.appendChild(newArrow);

	var path = MorphSVGPlugin.pathDataToBezier("#arc");
	TweenMax.to([newArrow], 0.5, {
		force3D: true,
		bezier: {
			type: "cubic",
			values: path,
			autoRotate: ["x", "y", "rotation"]
		},
		onUpdate: hitTest,
		onUpdateParams: ["{self}"],
		onComplete: onMiss,
		ease: Linear.easeNone
	});
	TweenMax.to("#arc", 0.2, {
		opacity: 0
	});
	
	TweenMax.set(".arrow-angle use", {
		opacity: 0
	});
}

function hitTest(tween) {
	var arrow = tween.target[0];
	var transform = arrow._gsTransform;
	var radians = transform.rotation * Math.PI / 180;
	var arrowSegment = {
		x1: transform.x,
		y1: transform.y,
		x2: (Math.cos(radians) * 60) + transform.x,
		y2: (Math.sin(radians) * 60) + transform.y
	};

	var intersection = getIntersection(arrowSegment, lineSegment);
	if (intersection && intersection.segment1 && intersection.segment2) {
		tween.pause();
		var dx = intersection.x - target.x;
		var dy = intersection.y - target.y;
		var distance = Math.sqrt((dx * dx) + (dy * dy));
		var selector = ".hit";
		if (distance < 7) {
			selector = ".bullseye";
		}
		showMessage(selector);
	}
}

function onMiss() {
	showMessage(".miss");
}

function showMessage(selector) {
	TweenMax.killTweensOf(selector);
	TweenMax.killChildTweensOf(selector);
	TweenMax.set(selector, {
		autoAlpha: 1
	});
	TweenMax.staggerFromTo(selector + " path", .5, {
		rotation: -5,
		scale: 0,
		transformOrigin: "center"
	}, {
		scale: 1,
		ease: Back.easeOut
	}, .05);
	TweenMax.staggerTo(selector + " path", .3, {
		delay: 2,
		rotation: 20,
		scale: 0,
		ease: Back.easeIn
	}, .03);
}

function getMouseSVG(e) {
	var clientX, clientY;

	if (e.touches && e.touches.length > 0) {
		clientX = e.touches[0].clientX;
		clientY = e.touches[0].clientY;
	} else if (e.changedTouches && e.changedTouches.length > 0) {
		clientX = e.changedTouches[0].clientX;
		clientY = e.changedTouches[0].clientY;
	} else {
		clientX = e.clientX;
		clientY = e.clientY;
	}

	if (clientX === undefined || clientY === undefined) return null;

	var ctm = svg.getScreenCTM();
	if (!ctm) return null;

	cursor.x = clientX;
	cursor.y = clientY;
	return cursor.matrixTransform(ctm.inverse());
}

function getIntersection(segment1, segment2) {
	var dx1 = segment1.x2 - segment1.x1;
	var dy1 = segment1.y2 - segment1.y1;
	var dx2 = segment2.x2 - segment2.x1;
	var dy2 = segment2.y2 - segment2.y1;
	var cx = segment1.x1 - segment2.x1;
	var cy = segment1.y1 - segment2.y1;
	var denominator = dy2 * dx1 - dx2 * dy1;
	if (denominator == 0) {
		return null;
	}
	var ua = (dx2 * cy - dy2 * cx) / denominator;
	var ub = (dx1 * cy - dy1 * cx) / denominator;
	return {
		x: segment1.x1 + ua * dx1,
		y: segment1.y1 + ua * dy1,
		segment1: ua >= 0 && ua <= 1,
		segment2: ub >= 0 && ub <= 1
	};
}
function createWindParticles() {
  var svgNS = "http://www.w3.org/2000/svg";
  var particleGroup = document.createElementNS(svgNS, "g");
  particleGroup.setAttribute("class", "particles");
  svg.insertBefore(particleGroup, svg.firstChild);

  for (var i = 0; i < 20; i++) {
    var circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("r", Math.random() * 2 + 1);
    circle.setAttribute("fill", "#ffffff");
    circle.setAttribute("opacity", Math.random() * 0.4 + 0.1);
    particleGroup.appendChild(circle);

    // Animate across screen
    TweenMax.set(circle, {
      x: Math.random() * 1000,
      y: Math.random() * 500
    });

    TweenMax.to(circle, Math.random() * 3 + 2, {
      x: "+=200",
      y: "+=30",
      repeat: -1,
      ease: Linear.easeNone
    });
  }
}

// Call on startup
createWindParticles();
