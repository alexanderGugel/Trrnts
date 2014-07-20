angular.module('trrntsApp.directives', [])

.directive('barChart', function () {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {
      element = element[0];
      var barWidth = attrs.barWidth || 20;
      var barSpace = attrs.barSpace || 1;

      // Chart height needs to be specified using attribute AND CSS. Otherwise
      // Fx will throw crazy errors. Don't try to do something like
      // element.outerHeight. It won't work.
      var chartHeight = attrs.barChartHeight || 70;
      var highlightHeightDiff = attrs.highlightHeightDiff || 20;

      var data = scope.magnet.peers || {};
      var chart = d3.select(element);

      var formattedData = [];
      for (var i = 0; i < data.length; i += 2) {
        formattedData.unshift({
          peers: parseInt(data[i]),
          t: parseInt(data[i+1])
        });
      }

      data = formattedData;

      var y = d3.scale.linear()
                .domain([0, d3.max(data, function (d) {
                  return d.peers;
                })])
                .range([0, chartHeight - highlightHeightDiff]);

      // Initializes a new tooltip.
      var tip = d3.tip()
        .attr('class', 'd3-tip')
        .offset([-highlightHeightDiff-10, 0])
        .html(function(d) {
          return '<strong>' + d.peers + '</strong> peers <span>' + moment(parseInt(d.t)).fromNow() + '</span>';
        });

      // Adds tooltip to chart.
      chart.call(tip);

      var bar = d3.select(element)
        .selectAll('rect')
          .data(data);

      bar.enter().append('rect')
          .attr('class', 'bar')
          .attr('width', barWidth)
          .attr('x', function (d, i) { return barWidth*i + barSpace*i; })
          .attr('y', chartHeight)
          .attr('height', 0)
          .transition()
          .duration(300)
          .ease('elastic')
          .delay(function (d, i) { return (0.7*i)*30; })
          .attr('y', function (d, i) { return chartHeight-y(d.peers); })
          .attr('height', function (d) { return y(d.peers); });

      bar.on('mouseover', function (d, i) {
        var currentBar = bar.filter(function (d, k) {
          return k === i;
        })
        .transition()
        .ease('bounce')
        .attr('y', function () { return chartHeight - y(d.peers) - highlightHeightDiff; })
        .attr('height', function () { return y(d.peers) + highlightHeightDiff; });

        // Show tooltip.
        tip.show(d);
      });

      bar.on('mouseleave', function (d, i) {
        var currentBar = bar.filter(function (d, k) {
          return k === i;
        })
        .transition()
        .ease('bounce')
        .attr('y', function (d, i) { return chartHeight - y(d.peers); })
        .attr('height', function (d) { return y(d.peers); });

        // Hide tooltip.
        tip.hide(d);
      });
    }
  };
})

.directive('worldMap', function () {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {

      var generateStats = function (lls) {
        var formatedLLs = [];
        for (var ll in lls) {
          var bubble = {
            fillKey : 'torrents',
            radius :  lls[ll]
          };

          var latAndLong = ll.split(',');
          bubble.latitude = latAndLong[0];
          bubble.longitude = latAndLong[1];
          if (latAndLong.length > 1) {
            formatedLLs.push(bubble);
          }
        }

        return formatedLLs;
      };

      var map = new Datamap({
        'element': element[0],
        fills: {
          defaultFill: '#ccc',
          torrents: '#222'
        }
      });

      // Generate Stats
      var llStats = generateStats(scope.location);
      map.bubbles(llStats, {
        popupTemplate: function (geo, data) {
          return '<div class="hoverinfo"> Total Number of Torrents: <strong>' + 
                                              data.radius + '</strong></div>';
        }
      });
    },
  };
});
