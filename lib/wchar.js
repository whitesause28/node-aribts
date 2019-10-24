"use strict";

const iconv = require("iconv-lite");
const charTable = require("./wchar_table");

const charCode = {
    hiragana: 0x30,
    katakana: 0x31,
    mosaic_a: 0x32,
    mosaic_b: 0x33,
    mosaic_c: 0x34,
    mosaic_d: 0x35,
    prop_ascii: 0x36,
    prop_hiragana: 0x37,
    prop_katakana: 0x38,
    jis_kanji_1: 0x39,
    jis_kanji_2: 0x3A,
    symbol: 0x3B,
    kanji: 0x42,
    ascii: 0x4A,
    jis_x0201_katakana: 0x49
};

const charMode = {
    graphic: 1,
    drcs: 2,
    other: 3
};

class TsWChar {
    constructor(buffer) {
        this.buffer = buffer;
        this.position = 0;

        this.graphic = [charCode.kanji, charCode.ascii, charCode.hiragana, charCode.katakana];
        this.graphicMode = [charMode.graphic, charMode.graphic, charMode.graphic, charMode.graphic];
        this.graphicByte = [2, 1, 1, 1];
        this.graphicL = 0;
        this.graphicR = 2;
        this.graphicNormal = true;

        this.str = "";
    }

    decode() {
        try {
            while (this.position < this.buffer.length) {
                const byte = this.buffer[this.position];

                if (byte <= 0x20) {
                    // C0
                    this.readC0();
                } else if (byte <= 0x7E) {
                    // GL
                    this.readGL();
                } else if (byte <= 0xA0) {
                    // C1
                    this.readC1();
                } else if (byte !== 0xFF) {
                    // GR
                    this.readGR();
                } else {
                    this.position++;
                }
            }
        } catch (err) {
            // avoid
        }

        return this.str;
    }

    readC0() {
        switch (this.getNext()) {
            case 0x20:
                // SP
                if (this.graphicNormal) {
                    this.str += ("　");
                } else {
                    this.str += (" ");
                }

                break;

            case 0x0D:
                // APR
                this.str += ("\r\n");

                break;

            case 0x0E:
                // LS1
                this.graphicL = 1;

                break;

            case 0x0F:
                // LS0
                this.graphicL = 0;

                break;

            case 0x19:
                // SS2
                this.readSS2();

                break;

            case 0x1D:
                // SS3
                this.readSS3();

                break;

            case 0x1B:
                // ESC
                this.readESC();

                break;

            case 0x16 :
                // PAPF
                this.position += 1;

                break;

            case 0x1C:
                // APS
                this.position += 2;

                break;
        }
    }

    readC1() {
        switch (this.getNext()) {
            case 0x89:
                // MSZ
                this.graphicNormal = false;

                break;

            case 0x8A:
                // NSZ
                this.graphicNormal = true;

                break;

            case 0x88:
                // SSZ
                this.graphicNormal = false;

                break;

            case 0x8B:
                // SZX
                this.graphicNormal = this.getNext() !== 0x60;

                break;

            case 0x90:
                // COL
                if (this.getNext() === 0x20) {
                    this.position += 1;
                }

                break;

            case 0x91:
                // FLC
                this.position += 1;

                break;

            case 0x93:
                // POL
                this.position += 1;

                break;

            case 0x94:
                // WMM
                this.position += 1;

                break;

            case 0x95:
                // MACRO
                while (this.position < this.buffer.length && this.buffer[this.position] !== 0x4F) {
                    this.position++;
                }

                break;

            case 0x97:
                // HLC
                this.position += 1;

                break;

            case 0x98:
                // RPC
                this.position += 1;

                break;

            case 0x9D:
                // TIME
                if (this.getNext() === 0x20) {
                    this.position += 1;
                } else {
                    while (this.position < this.buffer.length && this.buffer[this.position] < 0x40 && this.buffer[this.position] > 0x43) {
                        this.position++;
                    }
                }

                break;

            case 0x9B:
                // CSI
                this.readCSI();

                break;
        }
    }

    readGL() {
        switch (this.graphicMode[this.graphicL]) {
            case charMode.graphic:
                switch (this.graphic[this.graphicL]) {
                    case charCode.prop_ascii:
                    case charCode.ascii:
                        this.str += (String.fromCodePoint(charTable.ascii[this.getNext()]));

                        break;

                    case charCode.jis_x0201_katakana:    // ascii
                        this.str += (String.fromCodePoint(charTable.jisx0201katakana[this.getNext()]));

                        break;

                    case charCode.hiragana:
                    case charCode.prop_hiragana:
                        this.str += (String.fromCodePoint(charTable.hiragana[this.getNext()]));

                        break;

                    case charCode.katakana:
                    case charCode.prop_katakana:
                        this.str += (String.fromCodePoint(charTable.katakana[this.getNext()]));

                        break;

                    case charCode.jis_kanji_1:
                    case charCode.jis_kanji_2:
                    case charCode.symbol:
                    case charCode.kanji:
                        this.str += (this.getChar(this.getNext(), this.getNext()));

                        break;
                }
                break;

            default:
                this.position += this.graphicByte[this.graphicL];
        }
    }

    readGR() {
        switch (this.graphicMode[this.graphicR]) {
            case charMode.graphic:
                switch (this.graphic[this.graphicR]) {
                    case charCode.prop_ascii:
                    case charCode.ascii:
                        this.str += (String.fromCodePoint(charTable.ascii[(this.getNext() & 0x7F)]));

                        break;

                    case charCode.hiragana:
                    case charCode.prop_hiragana:
                        this.str += (String.fromCodePoint(charTable.hiragana[(this.getNext() & 0x7F)]));

                        break;

                    case charCode.katakana:
                    case charCode.prop_katakana:
                        this.str += (String.fromCodePoint(charTable.katakana[(this.getNext() & 0x7F)]));

                        break;

                    case charCode.jis_x0201_katakana:    // katakana
                        this.str += (String.fromCodePoint(charTable.jisx0201katakana[(this.getNext() & 0x7F)]));

                        break;

                    case charCode.jis_kanji_1:
                    case charCode.jis_kanji_2:
                    case charCode.symbol:
                    case charCode.kanji:
                        this.str += (this.getChar(this.getNext() & 0x7F, this.getNext() & 0x7F));

                        break;
                }

                break;

            default:
                this.position += this.graphicByte[this.graphicR];
        }
    }

    readESC() {
        const byte = this.getNext();

        if (byte === 0x24) {
            const byte2 = this.getNext();

            if (byte2 >= 0x28 && byte2 <= 0x2B) {
                const byte3 = this.getNext();

                if (byte3 === 0x20) {
                    // DRCS
                    const byte4 = this.getNext();

                    this.graphic[byte2 - 0x28] = byte4;
                    this.graphicMode[byte2 - 0x28] = charMode.drcs;
                    this.graphicByte[byte2 - 0x28] = 2;
                } else if (byte3 === 0x28) {
                    // Ohter
                    const byte4 = this.getNext();

                    this.graphic[byte2 - 0x28] = byte4;
                    this.graphicMode[byte2 - 0x28] = charMode.other;
                    this.graphicByte[byte2 - 0x28] = 1;
                } else {
                    // Graphic
                    this.graphic[byte2 - 0x28] = byte3;
                    this.graphicMode[byte2 - 0x28] = charMode.graphic;
                    this.graphicByte[byte2 - 0x28] = 2;
                }
            } else {
                // Graphic
                this.graphic[0] = byte2;
                this.graphicMode[0] = charMode.graphic;
                this.graphicByte[0] = 2;
            }
        } else if (byte >= 0x28 && byte <= 0x2B) {
            const byte2 = this.getNext();

            if (byte2 === 0x20) {
                const byte3 = this.getNext();

                this.graphic[byte - 0x28] = byte3;
                this.graphicMode[byte - 0x28] = charMode.drcs;
                this.graphicByte[byte - 0x28] = 1;
            } else {
                this.graphic[byte - 0x28] = byte2;
                this.graphicMode[byte - 0x28] = charMode.graphic;
                this.graphicByte[byte - 0x28] = 1;
            }
        } else if (byte === 0x6E) {
            this.graphicL = 2;
        } else if (byte === 0x6F) {
            this.graphicL = 3;
        } else if (byte === 0x7C) {
            this.graphicR = 3;
        } else if (byte === 0x7D) {
            this.graphicR = 2;
        } else if (byte === 0x7E) {
            this.graphicR = 1;
        }
    }

    readSS2() {
        const holdL = this.graphicL;

        this.graphicL = 2;
        this.readGL();
        this.graphicL = holdL;
    }

    readSS3() {
        const holdL = this.graphicL;

        this.graphicL = 3;
        this.readGL();
        this.graphicL = holdL;
    }

    readCSI() {
        // TODO
    }

    getNext() {
        if (this.buffer.length === this.position) {
            throw new Error("Buffer out of range");
        }

        return this.buffer[this.position++];
    }

    getSjis(first, second) {
        if (first >= 0x75 && second >= 0x21) {
            let ret = [];
            const code = (first << 8) | second;

            if (code >= 0x7521 && code <= 0x764B) {
                ret = charTable.gaiji_2[code];
            } else if (code >= 0x7A4D && code <= 0x7E7D) {
                ret = charTable.gaiji_1[code];
            }

            if (ret === void 0) {
                ret = [];
            }

            return ret;
        }

        const row = first < 0x5F ? 0x70 : 0xB0;
        const cell = first & 1 ? (second > 0x5F ? 0x20 : 0x1F) : 0x7E;

        first = (((first + 1) >> 1) + row) & 0xFF;
        second = (second + cell) & 0xFF;

        return [first, second];
    }

    getChar(first, second) {
        if (first >= 0x75 && second >= 0x21) {
            let ret = 0;
            const code = (first << 8) | second;

            if (code >= 0x7521 && code <= 0x764B) {
                ret = charTable.gaiji[code];
            } else if (code >= 0x7A4D && code <= 0x7E7D) {
                ret = charTable.gaiji[code];
            }

            return String.fromCodePoint(ret);
        }

        const row = first < 0x5F ? 0x70 : 0xB0;
        const cell = first & 1 ? (second > 0x5F ? 0x20 : 0x1F) : 0x7E;

        first = (((first + 1) >> 1) + row) & 0xFF;
        second = (second + cell) & 0xFF;

        return iconv.decode([first,second], "shiftjis");
    }

    getBuffer() {
        return this.buffer;
    }
}

module.exports = TsChar;
