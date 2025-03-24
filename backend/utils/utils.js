export function handleUncaughtException(error) {
    console.error('Uncaught Exception:', error);
    // TODO: reportErrorToCentral(e);
    process.exit(1);
}

process.on('uncaughtException', handleUncaughtException);

export function hsvToRgb(colorHsv) {
    let h = colorHsv[0]
    let s = colorHsv[1]
    let v = colorHsv[2]

    const h_ = (h % 256) / 255;
    const s_ = (s % 256) / 255;
    const v_ = (v % 256) / 255;

    const c = v_ * s_;
    const x = c * (1 - Math.abs((h_ * 6) % 2 - 1));
    const m = v_ - c;
    let r, g, b;

    if (h_ >= 0 && h_ < 1 / 6) {
        [r, g, b] = [c, x, 0];
    } else if (h_ >= 1 / 6 && h_ < 2 / 6) {
        [r, g, b] = [x, c, 0];
    } else if (h_ >= 2 / 6 && h_ < 3 / 6) {
        [r, g, b] = [0, c, x];
    } else if (h_ >= 3 / 6 && h_ < 4 / 6) {
        [r, g, b] = [0, x, c];
    } else if (h_ >= 4 / 6 && h_ < 5 / 6) {
        [r, g, b] = [x, 0, c];
    } else if (h_ >= 5 / 6 && h_ < 6 / 6) {
        [r, g, b] = [c, 0, x];
    } else {
        [r, g, b] = [0, 0, 0]; // Invalid hue value, set to black
    }

    const [red, green, blue] = [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
    return [red,green,blue]
}

export function leftPad(str, length, padChar = ' ') {
    if (str.length >= length) {
        return str;
    }

    const padding = padChar.repeat(length - str.length);
    return padding + str;
}

export function areRectanglesIntersecting(rect1, rect2) {
    // Check if rect1 is to the left of rect2
    if (rect1.posX + rect1.width < rect2.posX || rect1.posX > rect2.posX + rect2.width) {
        return false;
    }
    // Check if rect1 is above rect2
    if (rect1.posY + rect1.height < rect2.posY || rect1.posY > rect2.posY + rect2.height) {
        return false;
    }
    // If neither of the above conditions is true, then the rectangles intersect
    return true;
}

export function calculateDistance(x1, y1, x2, y2){
    const deltaX = x2 - x1;
    const deltaY = y2 - y1;

    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    return distance;
}

export function mapValue(value, fromMin, fromMax, toMin, toMax) {
    // Ensure that the input value is within the input range
    value = Math.min(Math.max(value, fromMin), fromMax);

    // Calculate the percentage of the value in the input range
    const percentage = (value - fromMin) / (fromMax - fromMin);

    // Map the percentage to the output range
    const scaledValue = toMin + percentage * (toMax - toMin);

    return scaledValue;
}