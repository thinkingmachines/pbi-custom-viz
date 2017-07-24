/*
 *  Power BI Visual CLI
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual {
    "use strict";

    import Selection = d3.Selection;

    import pixelConverterFromPoint = powerbi.extensibility.utils.type.PixelConverter.fromPoint;

    function getData (values, role): any[] {
        return values.reduce(function (data, _values, value) {
            if (_values.source.roles[role]) {
                return _values.values;
            }
            return data;
        }, []);
    }

    function formatMeasure (d) {
        if (d > 1) {
            return compactInteger(d).toLowerCase();
        } else {
            return compactInteger(d * 100, 2) + '%';
        }
    }

    function leastSquares (xSeries, ySeries) {
        let xBar = d3.sum(xSeries) * 1.0 / xSeries.length;
        let yBar = d3.sum(ySeries) * 1.0 / ySeries.length;

        let ssXX = d3.sum(xSeries, function (d: any) { return Math.pow(d - xBar, 2); });
        let ssYY = d3.sum(ySeries, function (d: any) { return Math.pow(d - yBar, 2); });
        let ssXY = d3.sum(xSeries, function (d: any, i: any) { return (d - xBar) * (ySeries[i] - yBar); });

        let slope = ssXY / ssXX;
        let intercept = yBar - (xBar * slope);
        let rSquare = Math.pow(ssXY, 2) / (ssXX * ssYY);

        return [slope, intercept, rSquare];
    }

    export class Visual implements IVisual {
        private target: Selection<HTMLElement>;
        private host: IVisualHost;
        private settings: VisualSettings;
        private image: Selection<HTMLElement>;
        private header: Selection<HTMLElement>;
        private metric: Selection<HTMLElement>;
        private measure: Selection<HTMLElement>;
        private change: Selection<HTMLElement>;
        private changeValue: Selection<HTMLElement>;
        private changeLabel: Selection<HTMLElement>;
        private svg: Selection<HTMLElement>;
        private chart: Selection<HTMLElement>;
        private xAxis: Selection<HTMLElement>;
        private yAxis: Selection<HTMLElement>;
        private bars: Selection<HTMLElement>;
        private line: Selection<HTMLElement>;
        private trendLine: Selection<HTMLElement>;

        constructor(options: VisualConstructorOptions) {
            this.target = d3.select(options.element).append('div')
                .attr('class', 'card');

            this.image = this.target.append('div')
                .attr('class', 'image');

            this.metric = this.target.append('div')
                .attr('class', 'metric');

            this.header = this.target.append('div')
                .attr('class', 'header');
            this.measure = this.header.append('div')
                .attr('class', 'measure');
            this.change = this.header.append('div')
                .attr('class', 'change');
            this.changeValue = this.change.append('div')
                .attr('class', 'change-value');
            this.changeLabel = this.change.append('div')
                .attr('class', 'change-label');

            this.svg = this.target.append('svg');
            this.chart = this.svg.append('g').attr('class', 'chart');
            this.xAxis = this.chart.append('g')
                .attr('class', 'x axis');
            this.yAxis = this.chart.append('g')
                .attr('class', 'y axis')
                .attr('transform', 'translate(60, 20)');
            this.bars = this.chart.append('g')
                .attr('transform', 'translate(60, 20)');
            this.line = this.chart.append('path')
                .attr('transform', 'translate(60, 20)');
            this.trendLine = this.chart.append('line')
                .attr('class', 'trendline')
                .attr('transform', 'translate(60, 20)');

            this.host = options.host;
        }

        public update(options: VisualUpdateOptions) {
            try {
                let dataView = options && options.dataViews && options.dataViews[0];
                this.settings = Visual.parseSettings(dataView);

                // Reset
                this.image.html(null);
                if (this.settings.image.url) {
                    this.target.style('padding-top', '80px');
                    this.image.append('img')
                        .attr('src', this.settings.image.url)
                        .style('transform-origin', 'top left')
                        .style('transform', 'scale(' + (this.settings.image.scale / 100) + ')')
                } else {
                    this.target.style('padding-top', null);
                }

                this.metric.html(null);
                this.bars.html(null);
                this.line.attr('d', null);
                this.trendLine
                    .attr('x1', null)
                    .attr('y1', null)
                    .attr('x2', null)
                    .attr('y2', null);

                // Metric

                let metricValues = getData(dataView.categorical.values, 'metric');
                this.metric.text(metricValues[metricValues.length - 1]);

                // Measure

                let measureValues = getData(dataView.categorical.values, 'measure');
                this.measure
                    .style('font-size', pixelConverterFromPoint(this.settings.measure.fontSize))
                    .text(measureValues[measureValues.length - 1]);

                // Change

                let changeValues = getData(dataView.categorical.values, 'changeValue');
                let changeValue = changeValues[changeValues.length - 1];
                this.changeValue
                    .style('font-size', pixelConverterFromPoint(this.settings.change.fontSize))
                    .text(formatNumber(changeValue * 100, 2) + '%');
                let stateValues = getData(dataView.categorical.values, 'stateValue');
                let stateValue = stateValues[stateValues.length - 1];
                let changeColor;
                if (stateValue <= this.settings.change.limit1) {
                    changeColor = this.settings.change.color1;
                } else if (stateValue <= this.settings.change.limit2) {
                    changeColor = this.settings.change.color2;
                } else {
                    changeColor = this.settings.change.color3;
                }
                this.changeValue
                    .style('color', changeColor);

                this.changeLabel.text(this.settings.change.text);

                // Chart

                let chartTop = 40;
                if (this.settings.image.url && this.settings.image.url.length > 0) {
                    chartTop += 80;
                }
                let width = options.viewport.width - 60;
                let height = options.viewport.height - chartTop - 20 - 20 - 20;
                this.svg.attr('width', width + 60);
                this.svg.attr('height', height + 20 + 20);

                let xo = d3.scale.ordinal().rangeBands([0, width], 0.25);
                let xt = d3.time.scale().range([0, width]);
                let y = d3.scale.linear().range([height, 0]);
                let xAxis = d3.svg.axis().orient('bottom')
                    .scale(xt)
                    .tickFormat(d3.time.format('%b %Y'))
                    .ticks(2);
                let yAxis = d3.svg.axis().scale(y).orient('left').ticks(5)
                    .tickSize(-width)
                    .tickFormat(formatMeasure);

                // Data

                let dates = dataView.categorical.categories[0].values;
                let values = getData(dataView.categorical.values, 'chartMeasure');
                let data = dates.map(function (d, i) {
                    return {
                        date: d,
                        value: values[i]
                    };
                });

                xo.domain(data.map(function (d: any) { return d.date; }));
                xt.domain(d3.extent(data, function (d: any) { return d.date; }));
                y.domain([0, d3.max(data, function (d: any) { return d.value; })]);

                // Render

                this.xAxis.attr('transform', 'translate(60, ' + (height + 20) + ')')
                    .call(xAxis);
                this.yAxis.call(yAxis);

                if (this.settings.chart.type === 'bar') {
                    this.bars.selectAll('.bar').data(data).enter()
                        .append('rect')
                        .style('fill', this.settings.chart.color)
                        .attr('x', function (d: any) { return xo(d.date); })
                        .attr('y', function (d: any) { return y(d.value); })
                        .attr('width', xo.rangeBand())
                        .attr('height', function (d: any) { return height - y(d.value); });
                } else {
                    let line = d3.svg.line()
                        .x(function (d: any) { return xt(d.date); })
                        .y(function (d: any) { return y(d.value); });
                    this.line.datum(data).attr('d', <any>line)
                        .style('stroke', this.settings.chart.color);
                }

                if (this.settings.chart.showTrend) {
                    let trendX = d3.range(1, dates.length + 1);
                    let [slope, intercept, rSquare] = leastSquares(trendX, values);
                    let x1 = dates[0];
                    let y1 = slope + intercept;
                    let x2 = dates[dates.length - 1];
                    let y2 = slope * dates.length + intercept;
                    this.trendLine
                        .attr('x1', xt(<Date>x1))
                        .attr('y1', y(y1))
                        .attr('x2', xt(<Date>x2))
                        .attr('y2', y(y2))
                        .style('stroke', this.settings.chart.trendColor);
                }

            } catch (e) {
                console.error(e);
                throw e;
            }
        }

        private static parseSettings(dataView: DataView): VisualSettings {
            return VisualSettings.parse(dataView) as VisualSettings;
        }

        /**
         * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the
         * objects and properties you want to expose to the users in the property pane.
         *
         */
        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
            return VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options);
        }
    }
}
