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

    function getValues (values, role) {
        return values.find(function (dataValue) {
            return dataValue.source.roles[role];
        });
    }

    function formatMeasure (format, decimals = 2) {
        return function (d) {
            if (format === 'unit') {
                return compactInteger(d, decimals).toLowerCase();
            } else {
                return formatNumber(d * 100, decimals) + '%';
            }
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

    function getTooltipData (metric: string, format: string, d: any): VisualTooltipDataItem[] {
        return [
            {
                displayName: 'Period',
                value: d.date.toLocaleDateString()
            },
            {
                displayName: metric,
                value: formatMeasure(format)(d.value)
            }
        ]
    }

    export class Visual implements IVisual {
        private settings: VisualSettings;

        private target: Selection<HTMLElement>;
        private image: Selection<HTMLElement>;
        private date: Selection<HTMLElement>;
        private metric: Selection<HTMLElement>;
        private header: Selection<HTMLElement>;
        private measure: Selection<HTMLElement>;
        private change: Selection<HTMLElement>;
        private changeValue: Selection<HTMLElement>;
        private changeLabel: Selection<HTMLElement>;
        private svg: Selection<HTMLElement>;
        private chart: Selection<HTMLElement>;
        private xAxis: Selection<HTMLElement>;
        private yAxis: Selection<HTMLElement>;
        private barsContainer: Selection<HTMLElement>;
        private line: Selection<HTMLElement>;
        private trendLine: Selection<HTMLElement>;

        private host: IVisualHost;
        private selectionManager: ISelectionManager;

        private tooltipServiceWrapper: ITooltipServiceWrapper;

        constructor (options: VisualConstructorOptions) {
            this.target = d3.select(options.element).append('div')
                .attr('class', 'card');

            this.image = this.target.append('div')
                .attr('class', 'image');

            this.date = this.target.append('div')
                .attr('class', 'date');

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
                .attr('class', 'y axis');
            this.barsContainer = this.chart.append('g');
            this.line = this.chart.append('path');
            this.trendLine = this.chart.append('line')
                .attr('class', 'trendline');

            this.host = options.host;
            this.selectionManager = options.host.createSelectionManager();

            this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, options.element);
        }

        private updateChange (changeValues, stateValues, i?) {
            let changeValue = null;
            if (i) {
                changeValue = changeValues.values[i];
            } else if (changeValues.highlights) {
                changeValue = changeValues.highlights.find((v) => v);
            } else {
                changeValue = changeValues.values[changeValues.values.length - 1];
            }
            this.changeValue
                .style('font-size', pixelConverterFromPoint(this.settings.change.fontSize))
                .text(formatNumber(changeValue * 100, 2) + '%');
            let stateValue = null;
            if (i) {
                stateValue = stateValues.values[i];
            } else if (stateValues.highlights) {
                stateValue = stateValues.highlights.find((v) => v);
            } else {
                stateValue = stateValues.values[stateValues.values.length - 1];
            }
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
        }

        public update (options: VisualUpdateOptions) {
            try {
                let dataView = options && options.dataViews && options.dataViews[0];
                this.settings = Visual.parseSettings(dataView);

                // Reset

                this.image.html(null);
                this.date.html(null);
                this.metric.html(null);
                this.barsContainer.html(null);

                this.line.attr('d', null);
                this.trendLine
                    .attr('x1', null)
                    .attr('y1', null)
                    .attr('x2', null)
                    .attr('y2', null);

                // Data

                let category = dataView.categorical.categories[0];
                let dates = category.values;
                let chartMeasureValues = getValues(dataView.categorical.values, 'chartMeasure');
                let highlights = chartMeasureValues.highlights || false;
                let values = chartMeasureValues.values;
                let data = dates.map((d, i) => {
                    return {
                        date: d,
                        value: values[i],
                        selectionId: this.host.createSelectionIdBuilder()
                            .withCategory(category, i)
                            .createSelectionId(),
                        highlighted: highlights ? Boolean(highlights[i]) : true
                    };
                });

                // Card

                this.target.style('margin', this.settings.card.padding + 'px');

                // Image

                if (this.settings.image.url) {
                    this.image.append('img')
                        .attr('src', this.settings.image.url)
                        .style('transform-origin', 'top left')
                        .style('transform', 'scale(' + (this.settings.image.scale / 100) + ')')
                } else {
                    this.header.style('margin-top', null);
                }

                // Metric

                let metricValues = getValues(dataView.categorical.values, 'metric').values;
                let metric = metricValues[metricValues.length - 1];
                this.metric
                    .text(metric)
                    .style('font-size', pixelConverterFromPoint(this.settings.metric.fontSize))
                    .style('color', this.settings.metric.fontColor);

                // Measure

                let measure = null;
                let measureValues = getValues(dataView.categorical.values, 'measure');
                if (measureValues.highlights) {
                    measure = measureValues.highlights.find((v) => v);
                } else {
                    measure = measureValues.values[measureValues.values.length - 1];
                }
                this.measure
                    .style('font-size', pixelConverterFromPoint(this.settings.measure.fontSize))
                    .text(measure);

                // Date

                if (this.settings.date.show) {
                    this.date.append('div').text('As of');
                    let date = null;
                    if (measureValues.highlights) {
                        // UGH: So hackish!
                        date = dates[measureValues.highlights.indexOf(measure)];
                    } else {
                        date = dates[dates.length - 1];
                    }
                    this.date.append('div').text(d3.time.format('%b %Y')(date));
                }

                // Change

                let changeValues = getValues(dataView.categorical.values, 'changeValue');
                let stateValues = getValues(dataView.categorical.values, 'stateValue');
                this.updateChange(changeValues, stateValues);
                this.changeLabel.text(this.settings.change.text);

                // Chart

                let imageHeight = 40;
                let metricHeight = 25;
                let headerHeight = 40;
                let padding = this.settings.card.padding * 2;
                let xAxisHeight = 40;
                let yAxisWidth = 40;
                let chartTop = metricHeight + headerHeight;
                if (this.settings.image.url && this.settings.image.url.length > 0) {
                    chartTop += imageHeight;
                    this.image.style('display', 'block');
                } else {
                    this.image.style('display', 'none');
                }
                let width = options.viewport.width - yAxisWidth - padding;
                let height = options.viewport.height - xAxisHeight - chartTop - padding;
                this.svg.attr('width', width + yAxisWidth);
                this.svg.attr('height', height + headerHeight);

                let xo = d3.scale.ordinal().rangeBands([0, width], 0.25);
                let xt = d3.time.scale().range([0, width]);
                let y = d3.scale.linear().range([height, 0]);
                let xAxis = d3.svg.axis().orient('bottom')
                    .scale(xt)
                    .tickFormat(d3.time.format('%b %Y'))
                    .ticks(2);
                let yAxis = d3.svg.axis().scale(y).orient('left').ticks(5)
                    .tickSize(-width);

                // Render

                xo.domain(data.map(function (d: any) { return d.date; }));
                xt.domain(d3.extent(data, function (d: any) { return d.date; }));
                y.domain([0, d3.max(data, function (d: any) { return d.value; })]);

                let format = d3.max(values) > 1 ? 'unit' : 'percentage';
                yAxis.tickFormat(formatMeasure(format, 1));

                this.xAxis
                    .attr('transform', 'translate(' + yAxisWidth + ', ' + (height + 20) + ')')
                    .call(xAxis);
                this.yAxis
                    .attr('transform', 'translate(' + yAxisWidth + ', 20)')
                    .call(yAxis);

                if (this.settings.chart.type === 'bar') {

                    let bars = this.barsContainer
                        .attr('transform', 'translate(' + yAxisWidth + ', 20)')
                        .selectAll('.bar').data(data).enter()
                        .append('rect')
                        .attr('x', function (d: any) { return xo(d.date); })
                        .attr('y', function (d: any) { return y(d.value); })
                        .attr('width', xo.rangeBand())
                        .attr('height', function (d: any) { return height - y(d.value); })
                        .attr('class', 'bar')
                        .style('fill', this.settings.chart.color)
                        .style('opacity', function (d: any) {
                            return d.highlighted ? 1 : 0.5;
                        });
                    this.tooltipServiceWrapper.addTooltip(this.barsContainer.selectAll('.bar'),
                        (tooltipEvent: TooltipEventArgs<number>) => getTooltipData(metric, format, tooltipEvent.data),
                        (tooltipEvent: TooltipEventArgs<number>) => null);
                    bars
                        .on('click', (d: any, i) => {
                            let e = (<Event>d3.event);
                            let selectedBar = d3.select(e.target);
                            this.selectionManager.select(d.selectionId).then((ids) => {
                                let hasSelection = ids.length > 0;
                                bars.style('opacity', hasSelection ? 0.5 : 1);
                                let date = null;
                                let measure = null;
                                if (hasSelection) {
                                    selectedBar.style('opacity', 1);
                                    date = dates[i];
                                    measure = measureValues.values[i];
                                } else {
                                    date = dates[dates.length - 1];
                                    measure = measureValues.values[measureValues.values.length - 1];
                                }
                                this.date.select('div:last-child').text(d3.time.format('%b %Y')(date));
                                this.measure.text(measure);
                                this.updateChange(changeValues, stateValues, hasSelection ? i : undefined);
                            });
                            e.stopPropagation();
                        });
                } else {
                    let line = d3.svg.line()
                        .x(function (d: any) { return xt(d.date); })
                        .y(function (d: any) { return y(d.value); });
                    this.line.datum(data).attr('d', <any>line)
                        .attr('transform', 'translate(' + yAxisWidth + ', 20)')
                        .style('stroke', this.settings.chart.color);
                }

                if (this.settings.chart.showTrend && dates.length > 1) {
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
                        .attr('transform', 'translate(' + yAxisWidth + ', 20)')
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
        public enumerateObjectInstances (options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
            return VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options);
        }
    }
}
