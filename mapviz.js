
function createVisualization(data)
{

    let color = d3.scaleSequential([8, 0], d3.interpolateMagma);
    let format = d3.format(",d");
    let height = 1060;
    let width = 954;

let treemap = data => d3.treemap()
    .size([width, height])
    .paddingOuter(3)
    .paddingTop(19)
    .paddingInner(1)
    .round(true)
(d3.hierarchy(data)
 .sum(d => d.value)
 .sort((a, b) => b.value - a.value));

let Le = 0;
function $e(e){this.id=e,this.href=new URL(`#${e}`,location)+""}
$e.prototype.toString=function(){return"url("+this.href+")"};
function uid(e) {
    return new $e("0-" + (null == e? "" : e) + "-" + ++Le);
}

  const root = treemap(data);

  const svg = d3.create("svg")
      .attr("viewBox", [0, 0, width, height])
      .style("font", "10px sans-serif");

  const shadow = uid("shadow");

  svg.append("filter")
      .attr("id", shadow.id)
    .append("feDropShadow")
      .attr("flood-opacity", 0.3)
      .attr("dx", 0)
      .attr("stdDeviation", 3);

  const node = svg.selectAll("g")
    .data(d3.group(root, d => d.height))
    .join("g")
      .attr("filter", shadow)
    .selectAll("g")
    .data(d => d[1])
    .join("g")
      .attr("transform", d => `translate(${d.x0},${d.y0})`);

  node.append("title")
      .text(d => `${d.ancestors().reverse().map(d => d.data.name).join("/")}\n${format(d.value)}`);

  node.append("rect")
      .attr("id", d => (d.nodeUid = uid("node")).id)
      .attr("fill", d => color(d.height))
      .attr("width", d => d.x1 - d.x0)
      .attr("height", d => d.y1 - d.y0);

  node.append("clipPath")
      .attr("id", d => (d.clipUid = uid("clip")).id)
    .append("use")
      .attr("xlink:href", d => d.nodeUid.href);

  node.append("text")
      .attr("clip-path", d => d.clipUid)
    .selectAll("tspan")
    .data(d => d.data.name.split(/(?=[A-Z][^A-Z])/g).concat(format(d.value)))
    .join("tspan")
      .attr("fill-opacity", (d, i, nodes) => i === nodes.length - 1 ? 0.7 : null)
      .text(d => d);

  node.filter(d => d.children).selectAll("tspan")
      .attr("dx", 3)
      .attr("y", 13);

  node.filter(d => !d.children).selectAll("tspan")
      .attr("x", 3)
      .attr("y", (d, i, nodes) => `${(i === nodes.length - 1) * 0.3 + 1.1 + i * 0.9}em`);

  return svg.node();
}


    const data = { name : "root",
                   children : [
                       { name : "object1.o",
                         children: [
                             {name : ".text.function1", value : 100 },
                             {name : ".text.function2", value : 200 }]},
                       { name : "object2.o",
                         children: [
                             {name : ".text.someotherfunction1", value : 100 },
                             {name : ".text.someotherfunction2", value : 200 }]}]};



const filechooser = document.querySelector("#mapfilechooser");
filechooser.addEventListener('change', (event) => {
    if (filechooser.files.length == 0)
        return;
    analyze(filechooser.files[0]);
});

async function analyze (file) {
    const filecontent = await file.text();
    const data = parseMapFileText(filecontent);
    const main = document.querySelector("#main");
    main.innerHTML = "";
    if (data)
        main.appendChild(createVisualization(data));
    else
        main.innerHTML = `<span class="error"> Unable to parse map file</span>`
}

let regions = {
    "text" : { origin: 0, length: 0 },
    "data" : { origin: 0, length: 0 },
    "eeprom" : { origin: 0, length: 0 },
    "fuse" : { origin: 0, length: 0 },
    "lock" : { origin: 0, length: 0 },
    "signature" : { origin: 0, length: 0 },
    "user_signatures" : { origin: 0, length: 0 },
    "*default*" : { origin: 0, length: 0 },
};

let loadedfiles = [];
let symbols = {};

function parseMapFileText(contents) {
    let lines = contents.split("\n");
    for (let i = 0; i<lines.length;) {
        if (lines[i] == "Memory Configuration") {
            i = parseMemoryConfiguration(lines, i);
        } else if (lines[i] == "Linker script and memory map") {
            i = parseLoadedFilesAndSymbols(lines, i);
            i = parseSections(lines, i);
        } else {
            i++;
        }
    }
}

function parseMemoryConfiguration(lines, i) {
    i += 3;
    while (lines[i] != "") {
        let parts = lines[i].split(/\s+/);
        let region = regions[parts[0]];
        region.origin = parseInt(parts[1]);
        region.length = parseInt(parts[2]);
        i++;
    }
    return i;
}

const symbolRegex = /^\s+\[?(0x([0-9a-f])+)\]?\s+([a-zA-Z_\$][^\s]+)(\s+=\s+.*)?$/;
function parseLoadedFilesAndSymbols(lines, i) {
    i += 2;
    while (lines[i] != "") {
        let res = lines[i].match(/^LOAD (.+)$/);
        if (res) {
            loadedfiles.push(res[1]);
        } else if ((res = lines[i].match(symbolRegex))) {
            symbols[res[3]] = { name : res[3], section: null, value: parseInt(res[1])};
        }
        i++;
    }
    return i;
}

let outputsections = [];
let inputsections = [];
function parseSections(lines, i) {
    let current_name = "";
    let current_section = null;
    let current_os = null;
    while (i<lines.length) {
        let res = lines[i].match(/^( )?([^\s]+)\s+(0x([0-9a-f]+))\s+(0x([0-9a-f]+))( (.*))?$/);
        if (res) {
            /* This is a section with addr and size on same line */
            current_name = res[2];
            current_section = { name: current_name, addr: parseInt(res[3]), size: parseInt(res[5])};

            /* If there is a space char first up, it is an input section */
            if (res[1]) {
                current_section.type = "input";
                current_section.file = res[8];
                inputsections.push (current_section);
                current_os.children.push(current_section);
            } else {
                current_section.type = "output";
                current_section.children = [];
                current_os = current_section;
                outputsections.push (current_section);
            }
        } else if ((res = lines[i].match(symbolRegex))) {
            symbols[res[3]] = { name : res[3], section: current_section, value: parseInt(res[1]) };
        } else if ((res = lines[i].match(/^( )?([^\s]+)$/))) {
            /* Section with just name on first line, following line has addr and size */
            current_name = res[2];
        } else if ((res = lines[i].match(/^\s+(0x([0-9a-f]+))\s+(0x([0-9a-f]+))( (.*))?$/))) {
            current_section = { name: current_name, addr: parseInt(res[1]), size: parseInt(res[3])};
            /* Assumption: all input sections have a filename */
            if (res[6]) {
                current_section.file = res[6];
                current_section.type = "input";
                current_os.children.push(current_section);
            } else {
                current_section.type = "output";
                current_section.children = [];
                current_os = current_section;
            }

            let arr = current_section.type == "output" ? outputsections : inputsections;
            arr.push(current_section);
        }
        i++;
    }
    return i;
}
