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

    interface ViewModel {
        measure: any;
    };

    function visualTransform(options: VisualUpdateOptions, host: IVisualHost): ViewModel {
        let dataView = options && options.dataViews && options.dataViews[0];
        let values = dataView.categorical.values[0].values;
        let measure = values[values.length - 1];
        return {
            measure: measure
        };
    }

    export class Visual implements IVisual {
        private target: Selection<HTMLElement>;
        private host: IVisualHost;
        private settings: VisualSettings;
        private cardTitle: Selection<HTMLElement>;
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
            this.target = d3.select(options.element).append('div');
            this.cardTitle = this.target.append('div')
                .attr('class', 'card-title');
            this.measure = this.cardTitle.append('div')
                .attr('class', 'measure');
            this.change = this.cardTitle.append('div')
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
                .attr('transform', 'translate(60, 30)');
            this.bars = this.chart.append('g')
                .attr('transform', 'translate(60, 30)');
            this.line = this.chart.append('path')
                .attr('transform', 'translate(60, 30)');
            this.trendLine = this.chart.append('path')
                .style('stroke-dasharray', '3, 3')
                .attr('transform', 'translate(60, 30)');
            this.host = options.host;
        }

        public update(options: VisualUpdateOptions) {
            try {
                let dataView = options && options.dataViews && options.dataViews[0];
                this.settings = Visual.parseSettings(dataView);
                let viewModel: ViewModel = visualTransform(options, this.host);

                this.measure
                    .style('font-size', pixelConverterFromPoint(this.settings.measure.fontSize))
                    .datum(viewModel.measure)
                    .text(function (d) {
                        return compactInteger(d).toLowerCase();
                    });
                this.changeValue.text('7.19%');
                this.changeLabel.text('change from last year');

                let width = options.viewport.width - 60;
                let height = options.viewport.height - 80 - 30 - 30;
                this.svg.attr('width', width + 60);
                this.svg.attr('height', height + 30 + 30);

                let xo = d3.scale.ordinal().rangeBands([0, width], 0.05);
                let xt = d3.time.scale().range([0, width]);
                let y = d3.scale.linear().range([height, 0]);
                let xAxis = d3.svg.axis().orient('bottom')
                    .scale(xt)
                    .tickFormat(d3.time.format('%b %Y'))
                    .ticks(2);
                let yAxis = d3.svg.axis().scale(y).orient('left').ticks(5)
                    .tickSize(-width)
                    .tickFormat(function (d) {
                        return compactInteger(d).toLowerCase();
                    });

                let dates = dataView.categorical.categories[0].values;
                // FIXME: Use category.source.roles!
                let values = dataView.categorical.values[0].values;
                let trend = [];
                if (dataView.categorical.values.length > 1) {
                    trend = dataView.categorical.values[1].values;
                }
                let data = dates.map(function (d, i) {
                    return {
                        date: d,
                        value: values[i],
                        trend: trend.length > 0 && trend[i] || null,
                    };
                });

                xo.domain(data.map(function (d: any) { return d.date; }));
                xt.domain(d3.extent(data, function (d: any) { return d.date; }));
                y.domain(d3.extent(data, function (d: any) { return d.value; }));

                this.xAxis.attr('transform', 'translate(60, ' + (height + 30) + ')')
                    .call(xAxis);
                this.yAxis.call(yAxis);

                if (this.settings.chart.type === 'bar') {
                    this.line.attr('d', null);
                    this.bars.selectAll('.bar').data(data).enter()
                        .append('rect')
                        .style('fill', this.settings.chart.color)
                        .attr('x', function (d: any) { return xo(d.date); })
                        .attr('y', function (d: any) { return y(d.value); })
                        .attr('width', xo.rangeBand())
                        .attr('height', function (d: any) { return height - y(d.value); });
                } else {
                    this.bars.html(null);
                    let line = d3.svg.line()
                        .x(function (d: any) { return xt(d.date); })
                        .y(function (d: any) { return y(d.value); });
                    this.line.datum(data).attr('d', <any>line)
                        .style('stroke', this.settings.chart.color);
                }

                this.trendLine.attr('d', null);
                if (trend.length) {
                    let trendLine = d3.svg.line()
                        .x(function (d: any) { return xt(d.date); })
                        .y(function (d: any) { return y(d.trend); });
                    this.trendLine.datum(data).attr('d', <any>trendLine)
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
