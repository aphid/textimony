/*global compare: true, OCRAD: true; */
var container, full, fullCtx, img, words, type, typeCtx, rawdict, suspectdict, randomDoc, otop, json, txt, read, statement;

//TIMINGS
var letterInterval = 225;
var cycleInterval = 1200;

var wWorker;

var block = ["-", ".", "`", "--", "="];
var util = {};
util.wait = async function (ms) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, (ms));
    });
};
var Word = function (options) {
    var wd = this;
    if (!options.text || (block.indexOf(options.text.trim()) !== -1) || options.text.trim().length === 0) {
        options.text = "?";
        options.fail = true;
    }
    //console.log("word #" + statement.words.length + ": " + options.text);
    for (var opt in options) {
        this[opt] = options[opt];
    }
    this.potentials = [];
    this.potpos = 0;
    return wd;
};
Word.prototype.draw = async function () {
    var wd = this;
    return new Promise(async function (resolve) {
        wd.span.style.display = "none";
        var delay = 1250;
        //console.log("Drawing!" + this.text);
        busy = true;
        if (wd.endpos) {
            read.style.fontSize = "13vh";
            var fsize;
            var wordw = wd.endpos.x - wd.pos.x;
            var wordh = wd.wordBot - wd.wordTop;
            type.width = wordw || 1;
            type.height = wordh || 1;
            //console.log(wordw, wordh);
            typeCtx.clearRect(0, 0, type.width, type.height);
            txt.textContent = "";
            read.textContent = "";
            var readMsg = "";
            var wlist = [];
            if (wd.potentials.length > 1) {
                for (var i = 0; i < wd.potentials.length; i++) {
                    if (i !== wd.potentials.length - 1) {
                        fsize = 30 / wd.potentials.length;
                        if (fsize < 8) {
                            fsize = 8;
                        }
                    }
                    wlist.push(wd.potentials[i].word);
                }
                //read.style.fontSize = fsize + "vh";
                //readMsg = JSON.stringify(wlist);
            } else {
                readMsg = wd.text;
            }
            //console.log(type.width, type.height, word.pos.x);
            type.style.width = "50%";
            type.style.maxHeight = "25vh";
            typeCtx.drawImage(img, wd.pos.x, wd.wordTop, type.width, type.height, 0, 0, type.width, type.height);
            read.textContent = readMsg;
        }
        //console.log("starting cycle", wd.text);
        await wd.setUpCycle();
        //console.log("ending cycle", wd.text);
        //await (util.wait(delay))
        wd.span.style.display = "inline";
        if (wd.lineDiv.offsetHeight > wd.lineDiv.dataset.highest) {
            wd.lineDiv.dataset.highest = wd.lineDiv.offsetHeight;
            wd.lineDiv.style.minHeight = wd.lineDiv.offsetHeight + "px";
        }
        await util.wait(delay);
        console.log("returning draw");
        return resolve("finished");
    });
};
Word.prototype.setUpCycle = async function () {
    var wrd = this;
    var source = wrd.text.toLowerCase();
    //console.log(this.potentials.length, ":", this.potentials);
    if (wrd.potentials.length < 2) {
        await util.wait(cycleInterval);
    }
    wrd.cProcess = [wrd.word];
    //weed out potentials that match the word
    if (wrd.potentials.length === 1 && wrd.potentials[0].distance === 0) {
        readdata.textContent = "";
        read.textContent = "";
        return Promise.resolve();
    }
    for (let wd of wrd.potentials) {
        //console.dir(wd);
        var result = wrd.processLev(source, wd);
        wd.process = result;
    }
    //console.log("??????????????" + wrd.potentials.length);
    //console.log(wrd);
    for (let wd of wrd.potentials) {
        wrd.cProcess.push(wd.word);
        var src;
        read.textContent = wd.word;
        if (wd.type === "dict") {
            src = "aspell dictionary";
            read.style.color = "papayaWhip";
        } else if (wd.type === "suspect") {
            src = "DHS Watchwords List";
            read.style.color = "red";
        } else if (wd.type === "witness") {
            src = "Hearing Witness List";
            read.style.color = "green";
        } else if (wd.type === "committee") {
            src = "Committee membership list";
            read.style.color = "green";
        }
        readdata.textContent = "match: " + src + " distance: " + wd.distance;
        for (let proc of wd.process) {
            let time = null;
            if (wrd.cProcess.includes(proc)) {
                time = 1000;
            }
            //console.log("awaiting queue");
            await readQueue(proc, time);
            //console.log("queue read");
        }
    }
    readdata.textContent = "";
    read.textContent = "";
    console.log("returning cycle");
    return Promise.resolve();
};
readQueue = async function (wd, ms) {
    read.textContent = wd;
    if (!ms) {
        ms = 125;
    }
    await util.wait(ms);
    return Promise.resolve();
};
//return an array of all the steps between source and word
Word.prototype.processLev = function (source, wd) {
    var process = [source];
    var a = source;
    var b = wd.word;
    if (a === b) {
        return [a];
    }
    //console.log("#########", a, b, "#########");
    //console.log(source, wd);
    var lev = new Levenshtein(a, b);
    var steps = lev.getSteps();
    var tmp = a;
    for (var step of steps) {
        if (step[0] === "substitute") {
            //console.log("subbing");
            //console.log(step[0], step[1], step[2]);
            tmp = tmp.substring(0, step[1] - 1) + b[step[2] - 1] + tmp.substring(step[1], a.length);
            process.push(tmp);
        } else if (step[0] === "insert") {
            //console.log("inserting");
            //console.log(step[0], step[1], step[2]);
            //console.log("adding ", b[step[2] - 1], " after " + a[step[1] - 1]);
            tmp = tmp.substring(0, step[1]) + b[step[2] - 1] + tmp.substring(step[1], tmp.length);
            process.push(tmp);
        } else if (step[0] === "delete") {
            //console.log("deleting");
            //console.log(step[0], step[1], step[2]);
            tmp = tmp.substring(0, step[1] - 1) + tmp.substring(step[1], a.length);
            process.push(tmp);
        } else {
            console.log("oh word", step[0], step[1], step[2]);
        }
    }
    if (!process.includes(b)) {
        process.push(b);
    }
    if (!process.length) {
        console.log("process 0");
    }
    //console.log("________________________");
    //console.log(process);
    return process;
};
Word.prototype.color = function (index = 0) {
    //console.dir(this.potentials);
    var wd = this.potentials[index];
    if (!wd.type) {
        wd.type = unknown;
        this.span.color = "white";
    } else if (wd.type === "suspicious") {
        this.span.style.color = "red";
    } else if (wd.type === "dict") {
        this.span.style.color = "papayaWhip";
    } else {
        this.span.style.color = "white";
    }
};
Word.prototype.pots = async function () {
    if (this.rawResults) {
        for (var res of this.rawResults) {
            this.potentials.push({
                "word": res.word,
                "distance": res.distance,
                "type": "dict"
            });
        }
    }
    if (this.suspResults) {
        for (var sus of this.suspResults) {
            this.potentials.push({
                "word": sus.word,
                "distance": sus.distance,
                "type": "suspicious"
            });
        }
    }
    if (this.potentials.length >= 1) {
        this.flip();
    }
    await this.draw();
    return Promise.resolve();
};
Word.prototype.flip = async function () {
    var wd = this;
    var span = this.span;
    var thispot = this.potentials[this.potpos];
    span.textContent = thispot.word + " ";
    if (thispot.type === "suspicious") {
        span.style.color = "red";
    } else if (thispot.type === "dict") {
        span.style.color = "papayaWhip";
    } else {
        span.style.color = "white";
    }
    if (this.lineDiv.offsetHeight > this.lineDiv.dataset.highest) {
        this.lineDiv.dataset.highest = this.lineDiv.offsetHeight;
        this.lineDiv.style.minHeight = this.lineDiv.offsetHeight + "px";
    }
    words.scrollTop = words.scrollHeight;
    this.potpos++;
    if (this.potpos >= this.potentials.length) {
        this.potpos = 0;
    }
    var wTime = (300 / (thispot.distance || 1)) + 250 + (Math.random() * 100);
    await util.wait(wTime);
    /*if (thispot.type === "suspicious") {
      console.log("flipping from " + thispot.distance + " " + thispot.type + " " + thispot.word + " in " + (300 / thispot.distance + 250));
      console.table(wd.potentials);
    }*/
    wd.flip();
};
document.addEventListener("DOMContentLoaded", async function () {
    wWorker = new Worker('dist.js');
    wWorker.onmessage = function (result) {
        if (result.data === "ready") {
            init();
        } else {
            return Promise.resolve(result.data);
        }
    }
});

var init = async function () {

    console.log("setting up");
    //set up all the things.  fold thes into the object at some point
    container = document.querySelector("#container");
    full = document.querySelector("#full");
    fullCtx = full.getContext("2d");
    img = document.querySelector("img");
    words = document.querySelector("#words");
    theword = document.querySelector("#theword");
    worddata = document.querySelector("#worddata");
    otop = document.querySelector("#top");
    txt = document.querySelector("#text");
    read = document.querySelector("#readword");
    readdata = document.querySelector("#readdata");
    json = document.querySelector("#json");
    type = document.querySelector("#type");
    typeCtx = type.getContext("2d");
    if (!rawdict && !suspectdict) {
        var dicts = await Promise.all([get("dict.json"), get("suspect.json")]);
    }
    //console.dir(dicts);
    rawdict = JSON.parse(dicts[0]);
    suspectdict = JSON.parse(dicts[1]);
    docs = [{
            "title": "buckleyStatement",
            "pages": ["questionnaire00.jpg", "questionnaire01.jpg", "questionnaire02.jpg", "questionnaire03.jpg", "page0.jpg", "page1.jpg", "page2.jpg"]
        }
            , {
            "title": "litt",
            "pages": ["090521_litt-0.jpg", "090521_litt-1.jpg", "090521_litt-2.jpg"]
}];
    docs = [];
    var littResponses = {
        title: "littResponses",
        root: "090521_littresponses",
        last: 23
    };
    var clapperPost = {
        title: "clapperPost",
        root: "100720_clapperpost",
        last: 23
    };
    var clapperQfrs = {
        title: "clapperQfrs",
        root: "100720_clapperqfrs",
        last: 14
    };
    var prehearing = {
        "title": "prehearing",
        "root": "100921_prehearing",
        "last": 8
    };
    var attach1 = {
        "title": "attach1",
        "root": "110203_attach1",
        "last": 1
    };
    var attach21 = {
        "title": "attach2(1)",
        "root": "110203_attach2(1)",
        "last": 2
    };
    var dni = {
        "title": "dni",
        "root": "110216_dni",
        last: 33
    };
    var moreResponses = {
        "title": "110623_responses",
        "root": "110623_responses(1)",
        "last": 6
    };
    var clapper1 = {
        "title": "clapper1",
        "root": "110913_clapper(1)",
        "last": 10
    };
    var prehear = {
        "title": "110922_prehearing(4)",
        "root": "110922_prehearing(4)",
        "last": 20
    };
    var prehear5 = {
        "title": "130207_prehearing(5)",
        "root": "130207_prehearing(5)",
        "last": 27
    };
    var krasspre = {
        "title": "131217_krassprehearing",
        "root": "131217_krassprehearing",
        "last": 15
    };
    var pompeo = {
        "title": "170112_pre-hearing-011217",
        "root": "170112_pre-hearing-011217",
        "last": 39
    };
    var pompeoB = {
        "title": "170112_pre-hearing-b-011217",
        "root": "170112_pre-hearing-b-011217",
        "last": 20
    };
    var pompeoQ = {
        "title": "170112_questionnaire-011217",
        "root": "170112_questionnaire-011217",
        "last": 14
    };
    docs.push(buildPages(littResponses));
    docs.push(buildPages(clapperPost));
    docs.push(buildPages(prehearing));
    docs.push(buildPages(attach1));
    docs.push(buildPages(attach21));
    docs.push(buildPages(dni));
    docs.push(buildPages(moreResponses));
    docs.push(buildPages(clapper1));
    docs.push(buildPages(prehear));
    docs.push(buildPages(prehear5));
    docs.push(buildPages(krasspre));
    docs.push(buildPages(clapperQfrs));
    docs.push(buildPages(pompeo));
    docs.push(buildPages(pompeoB));
    docs.push(buildPages(pompeoQ));
    var url = new URL(window.location.href);
    var thedoc = docs[Math.floor(Math.random() * docs.length)];
    if (url.searchParams.get("title")) {
        var tDoc = url.searchParams.get("title");
        for (let doc of docs) {
            if (doc.title === tDoc) {
                thedoc = doc;
            }
        }
    }
    console.log(thedoc.title);



    statement = new Doc({
        pages: thedoc.pages,
        title: thedoc.title,
        root: thedoc.root
    });

};

//doc constructinator
var Doc = function (options) {
    var doc = this;
    this.pages = options.pages;
    this.hearingId = options.hearingId;
    this.root = options.root;
    this.title = options.title;
    this.currentPage = 0;
    console.log("hello");
    console.log(options.root);
    get("texts/" + options.root + ".json").then(function (result) {
        json.textContent = result;
        if (result) {
            doc.metadata = JSON.parse(result)[0];
            this.dataIndex = 0;
            //words.style.height = "94vh";

            doc.cycleData();
        } else {
            document.querySelector('#console').style.display = "none";
        }
    }).catch(function () {
        document.querySelector('#console').style.display = "none";
    });

    window.setTimeout(function () {
        json.style.display = "none";
        otop.style.display = "block";
        container.style.display = "block";
        doc.init();
    }, 8000);
    //this.newline;
};

Doc.prototype.cycleData = async function () {
    if (this.dataIndex < (Object.keys(this.metadata).length - 1)) {
        this.dataIndex++;
    } else {
        this.dataIndex = 0;
    }

    document.querySelector("#data").textContent = Object.keys(this.metadata)[this.dataIndex] + ": " + Object.values(this.metadata)[this.dataIndex];
    await util.wait(8000);

    this.cycleData();
}
Doc.prototype.upWords = function () {
    
    //not gallery version, don't save
    return Promise.resolve();
    form = {
        "page": this.currentPage,
        "words": this.words,
        "root": this.root,
        "title": this.title
    };

    return new Promise(function (resolve) {
        var sData = JSON.stringify(form);
        console.log("sending image");
        try {
            fetch("https://illegible.us:3000", {
                method: "post",
                body: sData
            }).then(json).then(function (data) {
                console.log("Request succeeded with JSON response", data);

                return resolve();
            }).catch(function (error) {
                console.log("Request failed", error);
            });
        } catch (e) {
            console.log("fetch catch backup", e);
        }

    });
};

Doc.prototype.upImage = function () {
    //for nongallery version, don't save findings
    return Promise.resolve()
    form = {
        "page": this.currentPage,
        "pageImg": full.toDataURL(),
        "root": this.root,
        "title": this.title
    };

    return new Promise(function (resolve) {
        var sData = JSON.stringify(form);
        console.log("sending image");
        try {
            fetch("https://illegible.us:3000", {
                method: "post",
                body: sData
            }).then(json).then(function (data) {
                console.log("Request succeeded with JSON response", data);

                return resolve();
            }).catch(function (error) {
                console.log("Request failed", error);
            });
        } catch (e) {
            console.log("fetch catch backup", e);
        }
    });
};

function buildPages(doc) {
    doc.pages = [];
    //    console.log(doc);
    for (var i = 0; i < doc.last + 1; i++) {
        doc.pages[i] = doc.root + "-" + i + ".jpg";
    }
    return doc;
}
Doc.prototype.init = function () {
    this.lines = [];
    this.text = "";
    this.letters = [];
    this.words = [];
    this.word = {
        text: ""
    };
    this.dLetters = [];
    this.currentLine = 0;
    this.currentChr = 0;
    var doc = this;
    console.log("init");
    document.querySelector("img").onload = async function () {

        typeCtx.clearRect(0, 0, type.width, type.height);
        read.textContent = "";
        console.log("copying img");
        full.style.top = "0";
        await util.copyImage(this);
        doc.process();
    };
    this.loadPage();
};


util.copyImage = async function (img) {
    full.width = img.width;
    full.height = img.height;
    fullCtx.clearRect(0, 0, full.width, full.height);
    var line = 0;
    /*
    while (line < img.height) {
        //fullCtx.drawImage(this, 0, 0);
        fullCtx.drawImage(img, 0, line, img.width, 1, 0, line, full.width, 1);
        line++;
        if (line % 3 === 0) {
            await util.wait(16);
    }
    */
    fullCtx.drawImage(img, 0, 0, img.width, img.height);
    return Promise.resolve();
};

Doc.prototype.process = function () {
    this.getLines().processLines();
};
Doc.prototype.processLines = function () {
    var doc = this;
    console.log("got " + this.lines.length + " lines, processing");
    for (var i = 0; i < this.lines.length; i++) {
        var line = this.lines[i];
        fullCtx.fillStyle = "rgb(0,0,0)";
        //console.dir(line);
        for (var j = 0; j < line.letters.length; j++) {
            var letter = line.letters[j];
            letter.lineNum = line.num;
            if (j === line.letters.length - 1) {
                letter.wordEnd = true;
                letter.lineEnd = true;
            }
            letter.lineHeight = line.height;
            if (letter.height > 100 || letter.width > 200) {
                //big letter, idk.
                this.letters.push(letter);
            } else {
                this.letters.push(letter);
            }
        }
    }
    doc.drawLetters();
};
//takes cluster of letters, "reads" and processes
Doc.prototype.addWord = function (word) {
    //console.log("&&&&&&&&&&&&&&&& adding word " + word.text);
    var doc = this;
    return new Promise(async function (resolve) {
        if (!word || word.fail) {
            //console.log("%%%%%%%%%%%% no word");
            return resolve("no word");
        } else {
            console.log(word.lineNum);
            word.pageDiv = document.querySelector("#page" + doc.currentPage);
            //sees if we need a newline
            if (!document.querySelector("#line" + doc.currentPage + "_" + word.lineNum)) {
                word.lineDiv = document.createElement("div");
                word.lineDiv.id = "line" + doc.currentPage + "_" + word.lineNum;
                word.lineDiv.classList.add("line");
                word.pageDiv.appendChild(word.lineDiv);
            } else {
                word.lineDiv = document.querySelector("#line" + doc.currentPage + "_" + word.lineNum);
            }
            word.rawResults = [];
            var span = document.createElement("span");
            span.style.display = "none";
            var ssize;
            ssize = word.lineHeight * .7;
            if (ssize > 50) {
                ssize = 50;
            }
            if (ssize < 25) {
                ssize = 25;
            }

            span.style.fontSize = ssize + "px";
            console.log(span.style.fontSize);
            //i forget this use case
            if (word.text !== "? ") {
                doc.words.push(word);
            }
            //adds space
            span.textContent = word.text + " ";
            word.span = span;
            word.lineDiv.appendChild(span);
            word.lineDiv.dataset.highest = word.lineDiv.offsetHeight;
            //scrolls into view
            words.scrollTop = words.scrollHeight;
            var comp;
            if (word.text.length > 2) {
                word.clean = word.text.replace(/[^a-zA-Z0-9]+/g, "");
                //word.clean = word.text;
                console.time(word.clean);
                comp = await compare(word.clean, "raw");
                console.timeEnd(word.clean);
                if (comp) {
                    //one result
                    if (comp.low === 0 || comp.words.length === 1) {
                        span.textContent = comp.words[0].word + " ";
                    } else {
                        span.textContent = comp.words[0].word + " ";
                        //lolidk
                        if (word.lineDiv.offsetHeight > word.lineDiv.dataset.highest) {
                            word.lineDiv.dataset.highest = word.lineDiv.offsetHeight;
                            word.lineDiv.style.minHeight = word.lineDiv.offsetHeight + "px";
                        }
                    }
                    word.rawResults = comp.words;
                } else {
                    console.log("no results for ", word.text, " in dict");
                    word.compFailed = true;
                    span.classList.add("iffy");
                }
                comp = await compare(word.clean, "susp");
                if (comp) {
                    span.classList.add("suspect");
                    if (comp.low === 0) {
                        span.textContent = comp.words[0].word + " ";
                    } else {
                        span.textContent = comp.words[0].word + " ";
                        if (word.lineDiv.offsetHeight > word.lineDiv.dataset.highest) {
                            word.lineDiv.dataset.highest = word.lineDiv.offsetHeight;
                            word.lineDiv.style.minHeight = word.lineDiv.offsetHeight + "px";
                        }
                        //span.textContent = span.textContent + JSON.stringify(comp);
                    }
                    word.suspResults = comp.words;
                } else {
                    console.log("no results in susp for ", word.text);
                    //word.compFailed = true;
                    //span.classList.add("iffy");
                }
                await word.pots();
                console.log("&&&&&& ending word", word.text);
                return resolve();
            } else {
                return resolve();
            }
        }
    });
};
Doc.prototype.drawLetters = async function () {
    var altWord;
    var doc = this,
        pct;
    var matches = "";
    this.dLetters.push(this.letters[this.currentChr]);
    this.currentChr++;
    //we"re at the end, start over.
    if (this.currentChr >= this.letters.length) {
        console.log("doc finished?");
        this.word.wordTop = 0;
        this.word.wordBot = 0;
        this.dLetters = [];

        typeCtx.clearRect(0, 0, type.width, type.height);
        read.textContent = "";
        await this.upImage()
        await this.upWords();
        await util.wait(3000);
        return this.init();
    }
    var letter = this.letters[this.currentChr];
    if (letter.lineNum !== doc.currentLine) {
        this.word.wordTop = 0;
        this.word.wordBot = 0;
        this.currentLine = letter.lineNum;
    }
    //console.dir(letter);
    if (!letter) {
        console.log("no letter at " + this.currentChr);
        return false;
    }
    pct = (letter.y / img.height) - 0.2;
    if (pct < 0) {
        pct = 0;
    }
    full.style.top = "-" + (full.offsetHeight * pct) + "px";
    if (letter.matches.length) {
        for (var match of letter.matches) {
            matches = matches + match.letter;
            //console.log(matches);
        }
        if (letter.wordEnd || matches.indexOf(" ") !== -1 || matches.indexOf(",") !== -1) {
            letter.wordEnd = true;
            if (letter.wordEnd) {
                //console.log("wordend, matches: " + matches);
                this.word.text = "" + this.word.text + letter.matches[0].letter;
            }
            if (letter.lineEnd) {
                this.word.lineEnd = true;
            }
            this.word.lineNum = letter.lineNum;
            this.word.lineHeight = letter.lineHeight;
            this.word.pos = {
                "x": this.letters[this.currentChr - (this.word.text.length - 1)].x,
                "y": this.letters[this.currentChr - (this.word.text.length - 1)].y
            };
            var lastlet = this.letters[this.currentChr];
            this.word.endpos = {
                "x": lastlet.x + lastlet.width,
                "y": lastlet.y + lastlet.height
            };
            if (this.word.text === "" || this.word.text === "-") {
                this.word = {
                    text: "",
                    wordTop: 0,
                    wordBot: 0
                };
            } else if (this.word.text.includes("--")) {
                var idx = this.word.text.indexOf("--");
                altWord = JSON.parse(JSON.stringify(this.word));
                altWord.wordTop = this.word.wordTop;
                altWord.wordBot = this.word.wordBot;
                altWord.text = this.word.text.split("--")[1];
                altWord.pos = {
                    "x": this.letters[this.currentChr - (altWord.text.length - 1)].x,
                    "y": this.letters[this.currentChr - (altWord.text.length - 1)].y
                };
                this.word.text = this.word.text.split("--")[0];
                this.word.endpos = {
                    "x": this.letters[this.currentChr - (this.word.text.length - 1 + idx)].x,
                    "y": this.letters[this.currentChr - (this.word.text.length - 1 + idx)].y
                };
                await this.addWord(new Word(this.word));
                await this.addWord(new Word(altWord));
            } else if (this.word.text.includes(":")) {
                altWord = JSON.parse(JSON.stringify(this.word));
                altWord.text = this.word.text.split(":")[1];
                this.word.text = this.word.text.split(":")[0];
                await this.addWord(new Word(this.word));
                //ugh need to figure out positioning
                await this.addWord(new Word(altWord));
            } else {
                await this.addWord(new Word(this.word));
            }
            this.word = {
                text: "",
                wordTop: 0,
                wordBot: 0
            };
            //start of word
        } else {
            this.word.text = "" + this.word.text + letter.matches[0].letter;
        }
        //blank letter image
        if (!this.word.wordTop || this.word.wordTop > letter.y) {
            this.word.wordTop = letter.y;
        }
        if (!this.word.wordBot || this.word.wordBot < letter.y + letter.height) {
            this.word.wordBot = letter.y + letter.height;
        }
        fullCtx.fillRect(letter.x, letter.y, letter.width, letter.height);
        fullCtx.fillRect(letter.x, letter.y, letter.width, letter.height);
        pct = (letter.y / img.height) - 0.02;
        full.style.top = "-" + (full.offsetHeight * pct) + "px";
        //full.style.top = "-" + (letter.y - 430) + "px";
        //full.style.left = "-" + (letter.x - 130) + "px";
        type.width = letter.width;
        type.height = letter.height;
        type.style.width = "auto";
        type.style.imageRendering = "-moz-crisp-edges";
        type.style.height = "100%";
        type.style.maxHeight = "25vh";
        typeCtx.clearRect(0, 0, type.width, type.height);
        //copy letter image
        typeCtx.drawImage(img, letter.x, letter.y, letter.width, letter.height, 0, 0, type.width, type.height);
        read.style.fontSize = "15vh";
        read.style.color = "white";
        //blank letter
        read.textContent = "";
        read.textContent = matches;
    } else {
        //letter unknown
        read.style.fontSize = "15vh";
        read.textContent = "???";
    }
    //console.log("done drawing letter");
    if (this.dLetters.length === this.letters.length) {
        console.log("length reached");
        console.log("done");
        this.dLetters = [];
        await doc.upImage();
        this.word.wordTop = 0;
        this.word.wordBot = 0;
        return true;
    } else {
        //console.log("another");
        await util.wait(letterInterval);
        return doc.drawLetters();
    }
};
Doc.prototype.loadPage = function () {

    if (!this.url) {
        this.url = new URL(window.location.href);
    }
    var page;
    var pageDiv = document.createElement("div");

    var urlPage = this.url.searchParams.get("page") || 0;
    console.log(urlPage);

    if (!img.src) {
        console.log("no image, starting out, page", urlPage);
        this.currentPage = parseInt(urlPage, 10);
        page = this.pages[urlPage];
    } else if (this.currentPage >= this.pages.length - 1) {
        console.log("starting over");
        window.location.href = this.url.host + statement.url.pathname;
        /*
    } else if (this.url.searchParams.get("page") < this.pages.length) {
        console.log("page exists");
        this.currentPage = this.url.searchParams.get("page");
        console.log(this.currentPage);
        this.url.searchParams.delete('page');
        this.url.searchParams.append('page', this.currentPage);
        */
    } else {
        console.log(this.currentPage);
        this.currentPage = parseInt(this.currentPage + 1, 10);


        this.url.searchParams.delete('page');

        this.url.searchParams.delete("title");
        this.url.searchParams.append("title", this.title)
        this.url.searchParams.append("page", this.currentPage);
        console.log(this.url.href);
        window.location.href = this.url.href;
        console.log(this.currentPage);
        console.log("iterating page, now " + this.currentPage);
        page = this.pages[this.currentPage];
        var pageDivs = document.querySelectorAll(".page");
        for (var i = 0; i < pageDivs.length; i++) {
            if (i < this.currentPage - 1) {
                pageDivs[i].style.display = "none";
            }
        }
        words.scrollTop = words.scrollHeight;
    }
    if (this.metadata) {
        document.querySelector("#pages").textContent = "Page: " + (this.currentPage) + " / " + (parseInt(this.metadata.PageCount, 10) - 1);
    }
    console.log(this.currentPage);
    pageDiv.classList.add("page");
    pageDiv.id = "page" + this.currentPage;
    words.appendChild(pageDiv);
    img.src = '';
    img.src = "texts/" + page;
    console.log("loaded " + this.pages[this.currentPage]);
};
Doc.prototype.getLines = function () {
    //get line data from OCRAD
    var lines = OCRAD(img, {
        verbose: true
    }).lines;
    //filter out small lines and lines with no characters
    this.currentLine = 0;
    for (var line of lines) {
        if (line.height > 8 && line.letters.length) {
            line.num = this.currentLine;
            this.lines.push(line);
            this.currentLine++;
        }
    }
    return this;
};

function get(url) {
    // Return a new promise.
    return new Promise(function (resolve, reject) {
        // Do the usual XHR stuff
        var req = new XMLHttpRequest();
        req.open("GET", url);
        req.onload = function () {
            // This is called even on 404 etc
            // so check the status
            if (req.status === 200) {
                // Resolve the promise with the response text
                resolve(req.response);
            } else {
                // Otherwise reject with the status text
                // which will hopefully be a meaningful error
                reject(Error(req.statusText));
            }
        };
        // Handle network errors
        req.onerror = function () {
            reject(Error("Network Error"));
        };
        // Make the request
        req.send();
    });
}

var compare = async function (word, dict) {
    return new Promise(function (resolve) {

        wWorker.postMessage({
            word: word,
            dict: dict
        });
        wWorker.onmessage = function (result) {
            resolve(result.data);
        }
    });
};
