// The MIT License (MIT)

// Copyright (c) 2017 Zalando SE

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.


function radar_visualization(config) {

  // custom random number generator, to make random sequence reproducible
  // source: https://stackoverflow.com/questions/521295
  var seed = 42;
  function random() {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  function random_between(min, max) {
    return min + random() * (max - min);
  }

  function normal_between(min, max) {
    return min + (random() + random()) * 0.5 * (max - min);
  }

  // radial_min / radial_max are multiples of PI
  const quadrants = [
    { radial_min: 0, radial_max: 0.5, factor_x: 1, factor_y: 1 },
    { radial_min: 0.5, radial_max: 1, factor_x: -1, factor_y: 1 },
    { radial_min: -1, radial_max: -0.5, factor_x: -1, factor_y: -1 },
    { radial_min: -0.5, radial_max: 0, factor_x: 1, factor_y: -1 }
  ];

  const rings = [
    { radius: 130 },
    { radius: 220 },
    { radius: 310 },
    { radius: 400 }
  ];

  const title_offset =
    { x: -675, y: -420 };

  const footer_offset =
    { x: -675, y: 420 };

  const legend_offset = [
    { x: 450, y: 90 },
    { x: -675, y: 90 },
    { x: -675, y: -310 },
    { x: 450, y: -310 }
  ];

  function polar(cartesian) {
    var x = cartesian.x;
    var y = cartesian.y;
    return {
      t: Math.atan2(y, x),
      r: Math.sqrt(x * x + y * y)
    }
  }

  function cartesian(polar) {
    return {
      x: polar.r * Math.cos(polar.t),
      y: polar.r * Math.sin(polar.t)
    }
  }

  function bounded_interval(value, min, max) {
    var low = Math.min(min, max);
    var high = Math.max(min, max);
    return Math.min(Math.max(value, low), high);
  }


  function bounded_ring(polar, r_min, r_max) {
    return {
      t: polar.t,
      r: bounded_interval(polar.r, r_min, r_max)
    }
  }

  function bounded_box(point, min, max) {
    return {
      x: bounded_interval(point.x, min.x, max.x),
      y: bounded_interval(point.y, min.y, max.y)
    }
  }

  function segment(quadrant, ring) {
    var polar_min = {
      t: quadrants[quadrant].radial_min * Math.PI,
      r: ring == 0 ? 30 : rings[ring - 1].radius
    };
    var polar_max = {
      t: quadrants[quadrant].radial_max * Math.PI,
      r: rings[ring].radius
    };
    var cartesian_min = {
      x: 15 * quadrants[quadrant].factor_x,
      y: 15 * quadrants[quadrant].factor_y
    };
    var cartesian_max = {
      x: rings[3].radius * quadrants[quadrant].factor_x,
      y: rings[3].radius * quadrants[quadrant].factor_y
    };
    return {
      clipx: function(d) {
        var c = bounded_box(d, cartesian_min, cartesian_max);
        var p = bounded_ring(polar(c), polar_min.r + 15, polar_max.r - 15);
        d.x = cartesian(p).x; // adjust data too!
        return d.x;
      },
      clipy: function(d) {
        var c = bounded_box(d, cartesian_min, cartesian_max);
        var p = bounded_ring(polar(c), polar_min.r + 15, polar_max.r - 15);
        d.y = cartesian(p).y; // adjust data too!
        return d.y;
      },
      random: function() {
        return cartesian({
          t: random_between(polar_min.t, polar_max.t),
          r: normal_between(polar_min.r, polar_max.r)
        });
      }
    }
  }

  config.entries.length = 0;

  d3.tsv("https://docs.google.com/spreadsheets/d/e/2PACX-1vTvhU6qd7pr5KfTdJfn56B-cEny2MLMkRP6FvMJzfQgYP1vPGZt8-EqJLMwr3OgG04fTrGfFYDqSyYT/pub?output=tsv", function(data) {
      data.forEach(function (d) {

          entry = {
              quadrant : config.quadrants.findIndex( filterQuadName=>filterQuadName['name'] === d.Quadrant ),
              ring : config.rings.findIndex( filterRingName=>filterRingName['name'] === d.Verdict ),
              label : d.Technology,
              active: false,
              link: d.Link,
              score: d.Score,
              moved: (d.isNew === "TRUE" ? 1 : 0)
          };

          if (entry.quadrant < 0) {
            entry.quadrant = 0;
          }
          if (entry.ring < 0) {
            entry.ring = 0;
          }
          config.entries.push(entry);
  });

  // position each entry randomly in its segment
  for (var i = 0; i < config.entries.length; i++) {
    var entry = config.entries[i];
    entry.segment = segment(entry.quadrant, entry.ring);
    var point = entry.segment.random();
    entry.x = point.x;
    entry.y = point.y;
    entry.color = entry.active || config.print_layout ?
      config.quadrants[entry.quadrant].color : config.colors.inactive;
  }

  // partition entries according to segments
  var segmented = new Array(4);
  for (var quadrant = 0; quadrant < 4; quadrant++) {
    segmented[quadrant] = new Array(4);
    for (var ring = 0; ring < 4; ring++) {
      segmented[quadrant][ring] = [];
    }
  }

  for (var i=0; i<config.entries.length; i++) {
    var entry = config.entries[i];
    segmented[entry.quadrant][entry.ring].push(entry);
  }

  // assign unique sequential id to each entry
  var id = 1;
  for (var quadrant of [2,3,1,0]) {
    for (var ring = 0; ring < 4; ring++) {
      var entries = segmented[quadrant][ring];
      entries.sort(function(a,b) {
        //return a.label.localeCompare(b.label);
        return b.score.localeCompare(a.score);
      })
      for (var i=0; i<entries.length; i++) {
        entries[i].id = "" + id++;
      }
    }
  }

  function translate(x, y) {
    return "translate(" + x + "," + y + ")";
  }

  function viewbox(quadrant) {
    return [
      Math.max(0, quadrants[quadrant].factor_x * 400) - 420,
      Math.max(0, quadrants[quadrant].factor_y * 400) - 420,
      440,
      440
    ].join(" ");
  }

  var svg = d3.select("svg#" + config.svg_id)
    .style("background-color", config.colors.background)
    .attr("width", config.width)
    .attr("height", config.height);

  var radar = svg.append("g");
  if ("zoomed_quadrant" in config) {
    svg.attr("viewBox", viewbox(config.zoomed_quadrant));
  } else {
    radar.attr("transform", translate(config.width / 2, config.height / 2));
  }

  var grid = radar.append("g");

  // draw grid lines
  grid.append("line")
    .attr("x1", 0).attr("y1", -400)
    .attr("x2", 0).attr("y2", 400)
    .style("stroke", config.colors.grid)
    .style("stroke-width", 1);
  grid.append("line")
    .attr("x1", -400).attr("y1", 0)
    .attr("x2", 400).attr("y2", 0)
    .style("stroke", config.colors.grid)
    .style("stroke-width", 1);

  // draw rings
  for (var i = 0; i < rings.length; i++) {
    grid.append("circle")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", rings[i].radius)
      .style("fill", "none")
      .style("stroke", config.colors.grid)
      .style("stroke-width", 1);
    if (config.print_layout) {
      grid.append("text")
        .text(config.rings[i].name)
        .attr("y", -rings[i].radius + 62)
        .attr("text-anchor", "middle")
        .style("fill", "#e5e5e5")
        .style("font-family", "Arial, Helvetica")
        .style("font-size", 42)
        .style("font-weight", "bold")
        .style("pointer-events", "none")
        .style("user-select", "none");
    }
  }

  function legend_transform(quadrant, ring, index=null, xOffset=0, yOffset=0) {
    var numPrevEntries = 0;
    var numPrevInclEntries = 0;
    for (var r = 0; r<=ring; r++) {
        if (r < ring) {
            numPrevEntries += segmented[quadrant][r].length;
        }
        numPrevInclEntries += segmented[quadrant][r].length;
    }

    var dx = 0;
    var dy = (index == null ? 0 : (index+2) * 12);
    dy = dy + (ring*36) + (numPrevEntries * 12);

    if (dy >= 300) {
      var rootYOffset = 0;
      dy = dy - 300 - rootYOffset;
      dx += 140;
    }
    var entry = segmented[quadrant][ring][index];

    return translate(
      legend_offset[quadrant].x + dx + xOffset,
      legend_offset[quadrant].y + dy + yOffset
    );
  }

  // draw title and legend (only in print layout)
  if (config.print_layout) {
    // logo
    radar.append("svg:image")
        .attr("xlink:href", "https://www.dreamit.de/img/dream-it-logo.svg")
        .attr("transform", translate(title_offset.x, title_offset.y-50))
        .attr("width", 147)
        .attr("height", 52);

    // title
    radar.append("text")
      .attr("transform", translate(title_offset.x+160, title_offset.y))
      .text(config.title)
      .style("font-family", "Arial, Helvetica")
      .style("font-size", "24")
      .style("font-weight", "bold");

    // footer
    radar.append("text")
      .attr("transform", translate(footer_offset.x, footer_offset.y))
      .text("▲ new / moved     ● no change")
      .attr("xml:space", "preserve")
      .style("font-family", "Arial, Helvetica")
      .style("font-size", "10");

    // legend
    var legend = radar.append("g");
    for (var quadrant = 0; quadrant < 4; quadrant++) {
      legend.append("text")
        .attr("transform", translate(
          legend_offset[quadrant].x,
          legend_offset[quadrant].y - 45
        ))
        .text(config.quadrants[quadrant].title)
        .style("font-family", "Arial, Helvetica")
        .style("font-size", "18");
      for (var ring = 0; ring < 4; ring++) {
        legend.append("text")
          .attr("transform", legend_transform(quadrant, ring))
          .text(config.rings[ring].name)
          .style("font-family", "Arial, Helvetica")
          .style("font-size", "12")
          .style("font-weight", "bold");

          legend.selectAll(".legend" + quadrant + ring)
            .data(segmented[quadrant][ring])
            .enter()
            .each(function (d, i) {

              // just visualize legend as well
              if (d.moved != 0) {
                  d3.select(this).append("path")
                    .attr("transform", legend_transform(quadrant, ring, i, 3, -5))
                    .attr("d", "M -5,5 5,5 0,-4 z") // triangle pointing up for a "move / change" indication
                    .style("fill", config.quadrants[quadrant].color);
              } else {
                  d3.select(this).append("circle")
                    .attr("transform", legend_transform(quadrant, ring, i, 3, -5))
                    .attr("r", 3)
                    .attr("fill", config.quadrants[quadrant].color)
              }

              //if (d.hasOwnProperty("link")) {
              if (d.link) {
                  d3.select(this).append("a")
                      .attr("xlink:href", function (d, i) {
                          return d.link
                      })
                      //.attr("xlink:target","_blank") // this does not work - unfortunately, enable the following 2 lines if needed
                      //.attr("xlink:href", "#")
                      //.on("click", function(d, i) {  window.open(d.link); return false;})
                      .append("text")
                      .on("mouseover", showLink)
                      .on("mouseout", hideLink)
                      .attr("class", "legend" + "_" + d.id)
                      .attr("transform", legend_transform(quadrant, ring, i, 13, 0))
                      .text(d.id + ". " + d.label)
                      .style("font-family", "Arial, Helvetica")
                      .style("font-size", "11");
              } else {
                  d3.select(this).append("text")
                      .attr("class", "legend" + "_" + d.id)
                      .attr("transform", legend_transform(quadrant, ring, i, 13, 0))
                      .text(d.id + ". " + d.label)
                      .style("font-family", "Arial, Helvetica")
                      .style("font-size", "11");
              }
            });
      }
    }
  }

  // layer for entries
  var rink = radar.append("g")
    .attr("id", "rink");

  // rollover bubble (on top of everything else)
  var bubble = radar.append("g")
    .attr("id", "bubble")
    .attr("x", 0)
    .attr("y", 0)
    .style("opacity", 0)
    .style("pointer-events", "none")
    .style("user-select", "none");
  bubble.append("rect")
    .attr("rx", 4)
    .attr("ry", 4)
    .style("fill", "#333");
  bubble.append("text")
    .style("font-family", "sans-serif")
    .style("font-size", "10px")
    .style("fill", "#fff");
  bubble.append("path")
    .attr("d", "M 0,0 10,0 5,8 z")
    .style("fill", "#333");

  function showBubble(d) {
    if (d.active || config.print_layout) {
      d3.select(this)
          .style("cursor", "pointer");

      var tooltip = d3.select("#bubble text")
        .text(d.label);
      var bbox = tooltip.node().getBBox();
      d3.select("#bubble")
        .attr("transform", translate(d.x - bbox.width / 2, d.y - 16))
        .style("opacity", 0.8);
      d3.select("#bubble rect")
        .attr("x", -5)
        .attr("y", -bbox.height)
        .attr("width", bbox.width + 10)
        .attr("height", bbox.height + 4);
      d3.select("#bubble path")
        .attr("transform", translate(bbox.width / 2 - 5, 3));

      if (d.link) {
        d3.selectAll(".legend" + "_" + d.id)
          .style("font-weight", "bold")
          .style("text-decoration", "underline")
          .style("font-size", "11")
      }
    }
  }

  function hideBubble(d) {
    d3.select("#bubble")
      .attr("transform", translate(0, 0))
      .style("opacity", 0);

    if (d.link) {
      d3.selectAll(".legend" + "_" + d.id)
        .style("font-size", "11")
        .style("text-decoration", "none")
        .style("font-weight", "normal");
    }
  }

  function showLink(d) {
    d3.select(this)
      .style("font-weight", "bold")
      .style("text-decoration", "underline")
      .style("font-size", "11")
      .style("cursor", "pointer");
  }

  function hideLink(d) {
    d3.select(this)
      .style("font-weight", "normal")
      .style("text-decoration", "none")
      .style("font-size", "11")
      .style("cursor", "default");
  }

  // draw blips on radar
  var blips = rink.selectAll(".blip")
    .data(config.entries)
    .enter()
      .append("g")
        .attr("class", function(d, i) { return "blib" + "_" + d.id })
        .on("mouseover", showBubble)
        .on("mouseout", hideBubble);

  // configure each blip
  blips.each(function(d) {
    var blip = d3.select(this);

    // blip link
    if (d.link) {
        blip = blip.append("a")
            .attr("xlink:href", d.link)
            .attr("xlink:target", "_blank");
    }

    // blip shape
    if (d.moved > 0) {
      blip.append("path")
        .attr("d", "M -11,5 11,5 0,-13 z") // triangle pointing up
        .style("fill", d.color);
    } else if (d.moved < 0) {
      blip.append("path")
        .attr("d", "M -11,-5 11,-5 0,13 z") // triangle pointing down
        .style("fill", d.color);
    } else {
      blip.append("circle")
        .attr("r", 9)
        .attr("fill", d.color);
    }

    // blip text
    if (d.active || config.print_layout) {
      var blip_text = config.print_layout ? d.id : d.label.match(/[a-z]/i);
      blip.append("text")
        .text(blip_text)
        .attr("y", 3)
        .attr("text-anchor", "middle")
        .style("fill", "#fff")
        .style("font-family", "Arial, Helvetica")
        .style("font-size", function(d) { return blip_text.length > 2 ? "8" : "9"; })
        .style("pointer-events", "none")
        .style("user-select", "none");
    }
  });

  // make sure that blips stay inside their segment
  function ticked() {
    blips.attr("transform", function(d) {
      return translate(d.segment.clipx(d), d.segment.clipy(d));
    })
  }

  // distribute blips, while avoiding collisions
  d3.forceSimulation()
    .nodes(config.entries)
    .velocityDecay(0.19) // magic number (found by experimentation)
    .force("collision", d3.forceCollide().radius(12).strength(0.85))
    .on("tick", ticked);
  });
}
