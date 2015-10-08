// based on http://bl.ocks.org/kerryrodden/477c1bfb081b783f80ad
nv.models.sunburst = function() {
    "use strict";

    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------

    var margin = {top: 0, right: 0, bottom: 0, left: 0}
        , width = null
        , height = null
        , mode = "count"
        , modes = {count: function(d) { return 1; }, size: function(d) { return d.size }}
        , id = Math.floor(Math.random() * 10000) //Create semi-unique ID in case user doesn't select one
        , container = null
        , color = nv.utils.defaultColor()
        , groupColorByParent = true
        , duration = 500
        , dispatch = d3.dispatch('chartClick', 'elementClick', 'elementDblClick', 'elementMousemove', 'elementMouseover', 'elementMouseout', 'renderEnd')
        ;

    var x = d3.scale.linear().range([0, 2 * Math.PI]);
    var y = d3.scale.sqrt();

    var partition = d3.layout.partition()
        .sort(null)
        .value(function(d) { return 1; });

    var arc = d3.svg.arc()
        .startAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x))); })
        .endAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))); })
        .innerRadius(function(d) { return Math.max(0, y(d.y)); })
        .outerRadius(function(d) { return Math.max(0, y(d.y + d.dy)); });

    // Keep track of the current and previous node being displayed as the root.
    var node, prevNode;
    // Keep track of the root node
    var rootNode;

    //============================================================
    // chart function
    //------------------------------------------------------------

    var renderWatch = nv.utils.renderWatch(dispatch);

    function chart(selection) {
        renderWatch.reset();
        selection.each(function(data) {
            container = d3.select(this);
            var availableWidth = nv.utils.availableWidth(width, container, margin);
            var availableHeight = nv.utils.availableHeight(height, container, margin);
            var radius = Math.min(availableWidth, availableHeight) / 2;
            var box, path, text;

            nv.utils.initSVG(container);

            // Setup containers and skeleton of chart
            var wrap = container.selectAll('.nv-wrap.nv-sunburst').data(data);
            var wrapEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-wrap nv-sunburst nv-chart-' + id);

            var g = wrapEnter.selectAll('nv-sunburst');

            chart.update = function() {
                if ( duration === 0 ) {
                    container.call(chart);
                } else {
                    container.transition().duration(duration).call(chart);
                }
            };
            chart.container = this;


            wrap.attr('transform', 'translate(' + availableWidth / 2 + ',' + availableHeight / 2 + ')');

            container.on('click', function (d, i) {
                dispatch.chartClick({
                    data: d,
                    index: i,
                    pos: d3.event,
                    id: id
                });
            });

            y.range([0, radius]);

            node = node || data;
            rootNode = data[0];
            partition.value(modes[mode] || modes["count"]);
            box = g.data(partition.nodes).enter().append('g');
            path = box
                .append("path")
                .attr("d", arc)
                .style("fill", function (d) {
                    if (d.color) {
                        return d.color;
                    }
                    else if (groupColorByParent) {
                        return color((d.children ? d : d.parent).name);
                    }
                    else {
                        return color(d.name);
                    }
                })
                .style("stroke", "#FFF")
                .on("click", function(d) {
                    if (prevNode !== node && node !== d) prevNode = node;
                    node = d;
                    path.transition()
                        .duration(duration)
                        .attrTween("d", arcTweenZoom(d))
                        .each("end", function(e, i) {
                          // check if the animated element's data e lies within the visible angle span given in d
                          if (e.x >= d.x && e.x < (d.x + d.dx)) {
                            // get a selection of the associated text element
                            var arcText = d3.select(this.parentNode).select("text");
                            // fade in the text element and recalculate positions
                            arcText.transition().duration(750)
                              .attr("opacity", 1)
                              .attr('x', function(d){return d.x;})
                              .attr("transform", function(d) {
                                var multiLine = (d.name || "").split(" ").length > 1,
                                  orientation = 180 * x(d.x + d.dx / 2) / Math.PI - 90,
                                  radius = orientation + (multiLine ? -.5 : 0);
                                return "rotate("+radius+")translate("+(y(d.y)+5)+")rotate("+ (orientation > 90 ? -180 : 0)+")";
                              })
                          }
                      });
                })
                .each(stash)
                .on("dblclick", function(d) {
                    if (prevNode.parent == d) {
                        path.transition()
                            .duration(duration)
                            .attrTween("d", arcTweenZoom(rootNode));
                    }
                })
                .each(stash)
                .on('mouseover', function(d,i){
                    d3.select(this).classed('hover', true).style('opacity', 0.8);
                    dispatch.elementMouseover({
                        data: d,
                        color: d3.select(this).style("fill")
                    });
                })
                .on('mouseout', function(d,i){
                    d3.select(this).classed('hover', false).style('opacity', 1);
                    dispatch.elementMouseout({
                        data: d
                    });
                })
                .on('mousemove', function(d,i){
                    dispatch.elementMousemove({
                        data: d
                    });
                });
            text = box.append('text')
              .attr('x', function(d){return d.x;})
              .attr('transform', function(d){
                var multiLine = (d.name || "").split(" ").length > 1,
                  orientation = 180 * x(d.x + d.dx / 2) / Math.PI - 90,
                  radius = orientation + (multiLine ? -.5 : 0);
                return "rotate("+radius+")translate("+(y(d.y)+5)+")rotate("+ (orientation > 90 ? -180 : 0)+")";
              })
              .call(wrapText);

            function wrapText(text, width){
              text.each(function(){
                var text = d3.select(this),
                  words = text.text().split(/\s+/).reverse(),
                  word,
                  line= [],
                  lineNumber = 0,
                  lineHeight = 1.1,
                  y = text.attr('y'),
                  dy = parseFloat(text.attr('dy')),
                  tspan = text.text(null).append('tspan').attr('x', 0).attr('y', y).attr('dy', dy + "em");
                  while(word = words.pop()){
                    line.push(word);
                    tspan.text(line.join(" "));
                    if(tspan.node().getComputedTextLength() > width){
                      line.pop();
                      tspan.text(line.join(" "));
                      line = [word];
                      tspan = text.append("tspan").attr('x',0).attr('y',y).attr('dy', ++lineNumber * lineHeight + dy +"em").text(word);
                    }
                  }
              })
            }

            // Setup for switching data: stash the old values for transition.
            function stash(d) {
                d.x0 = d.x;
                d.dx0 = d.dx;
            }

            // When switching data: interpolate the arcs in data space.
            function arcTweenData(a, i) {
                var oi = d3.interpolate({x: a.x0, dx: a.dx0}, a);

                function tween(t) {
                    var b = oi(t);
                    a.x0 = b.x;
                    a.dx0 = b.dx;
                    return arc(b);
                }

                if (i == 0) {
                    // If we are on the first arc, adjust the x domain to match the root node
                    // at the current zoom level. (We only need to do this once.)
                    var xd = d3.interpolate(x.domain(), [node.x, node.x + node.dx]);
                    return function (t) {
                        x.domain(xd(t));
                        return tween(t);
                    };
                } else {
                    return tween;
                }
            }

            // When zooming: interpolate the scales.
            function arcTweenZoom(d) {
                var xd = d3.interpolate(x.domain(), [d.x, d.x + d.dx]),
                    yd = d3.interpolate(y.domain(), [d.y, 1]),
                    yr = d3.interpolate(y.range(), [d.y ? 20 : 0, radius]);
                return function (d, i) {
                    return i
                        ? function (t) {
                        return arc(d);
                    }
                        : function (t) {
                        x.domain(xd(t));
                        y.domain(yd(t)).range(yr(t));
                        return arc(d);
                    };
                };
            }

        });

        renderWatch.renderEnd('sunburst immediate');
        return chart;
    }

    //============================================================
    // Expose Public Variables
    //------------------------------------------------------------

    chart.dispatch = dispatch;
    chart.options = nv.utils.optionsFunc.bind(chart);

    chart._options = Object.create({}, {
        // simple options, just get/set the necessary values
        width:      {get: function(){return width;}, set: function(_){width=_;}},
        height:     {get: function(){return height;}, set: function(_){height=_;}},
        mode:       {get: function(){return mode;}, set: function(_){mode=_;}},
        id:         {get: function(){return id;}, set: function(_){id=_;}},
        duration:   {get: function(){return duration;}, set: function(_){duration=_;}},
        groupColorByParent: {get: function(){return groupColorByParent;}, set: function(_){groupColorByParent=!!_;}},

        // options that require extra logic in the setter
        margin: {get: function(){return margin;}, set: function(_){
            margin.top    = _.top    != undefined ? _.top    : margin.top;
            margin.right  = _.right  != undefined ? _.right  : margin.right;
            margin.bottom = _.bottom != undefined ? _.bottom : margin.bottom;
            margin.left   = _.left   != undefined ? _.left   : margin.left;
        }},
        color: {get: function(){return color;}, set: function(_){
            color=nv.utils.getColor(_);
        }}
    });

    nv.utils.initOptions(chart);
    return chart;
};
