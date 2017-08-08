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
                return formatNumber(d * 100) + '%';
            }
        }
    }

    function getTooltipData (left: any, right: any, d: any): VisualTooltipDataItem[] {
        return [
            {
                header: d.date.toLocaleDateString(),
                displayName: left.metric,
                // color: left.color,
                value: formatMeasure(left.format)(d.leftValue || 0)
            },
            {
                displayName: right.metric,
                // color: right.color,
                value: formatMeasure(right.format)(d.rightValue || 0)
            },
        ]
    }

    export class Visual implements IVisual {
        private settings: VisualSettings;

        private target: Selection<HTMLElement>;
        private svg: Selection<HTMLElement>;
        private chart: Selection<HTMLElement>;
        private xAxis: Selection<HTMLElement>;
        private leftYAxis: Selection<HTMLElement>;
        private leftLine: Selection<HTMLElement>;
        private leftActive: Selection<HTMLElement>;
        private rightYAxis: Selection<HTMLElement>;
        private rightLine: Selection<HTMLElement>;
        private rightActive: Selection<HTMLElement>;
        private hoverLine: Selection<HTMLElement>;
        private chartArea: Selection<HTMLElement>;
        private leftLegend: Selection<HTMLElement>;
        private rightLegend: Selection<HTMLElement>;

        private host: IVisualHost;
        private selectionManager: ISelectionManager;

        constructor (options: VisualConstructorOptions) {
            this.target = d3.select(options.element);

            this.svg = this.target.append('svg');
            this.chart = this.svg.append('g')
                .attr('class', 'chart');

            this.xAxis = this.chart.append('g')
                .attr('class', 'x axis');

            this.leftLine = this.chart.append('path')
                .attr('class', 'line');
            this.leftYAxis = this.chart.append('g')
                .attr('class', 'y axis');

            this.rightLine = this.chart.append('path')
                .attr('class', 'line');
            this.rightYAxis = this.chart.append('g')
                .attr('class', 'y axis');

            this.hoverLine = this.chart.append('line')
                .attr('class', 'hover')
                .style('display', 'none');
            this.leftActive = this.chart.append('circle')
                .attr('r', 3)
                .style('display', 'none');
            this.rightActive = this.chart.append('circle')
                .attr('r', 3)
                .style('display', 'none');

            this.chartArea = this.chart.append('rect')
                .attr('class', 'area');

            this.leftLegend = this.svg.append('g')
                .attr('class', 'legend');
            this.rightLegend = this.svg.append('g')
                .attr('class', 'legend');

            this.host = options.host;
            this.selectionManager = options.host.createSelectionManager();
        }

        public update (options: VisualUpdateOptions) {
            try {
                let dataView = options && options.dataViews && options.dataViews[0];
                if (!dataView) {
                    return;
                }
                this.settings = Visual.parseSettings(dataView);

                // Reset

                this.leftLine.attr('d', null);
                this.leftLegend.html(null);
                this.rightLine.attr('d', null);
                this.rightLegend.html(null);

                // Data

                let category = dataView.categorical.categories[0];
                let period = category.values;
                let leftMeasure = getValues(dataView.categorical.values, 'leftMeasure');
                let rightMeasure = getValues(dataView.categorical.values, 'rightMeasure');
                let data = period.map((d, i) => {
                    return {
                        date: d,
                        leftValue: leftMeasure.values[i],
                        rightValue: rightMeasure.values[i],
                        selectionId: this.host.createSelectionIdBuilder()
                            .withCategory(category, i)
                            .createSelectionId()
                    };
                });

                let legendHeight = 40;
                let xAxisHeight = 20;
                let yAxisWidth = 30;
                let width = options.viewport.width - 2 * yAxisWidth;
                let height = options.viewport.height - legendHeight - xAxisHeight;

                let xo = d3.scale.ordinal().rangeBands([0, width], 0.25);
                let xt = d3.time.scale().range([0, width]);
                let yl = d3.scale.linear().range([height, 0]);
                let yr = d3.scale.linear().range([height, 0]);

                xo.domain(data.map(function (d: any) { return d.date; }));
                xt.domain(d3.extent(data, function (d: any) { return d.date; }));
                let minl = this.settings.leftYAxis.min || 0;
                let maxl = this.settings.leftYAxis.max || d3.max(data, function (d: any) { return d.leftValue; });
                let minr = this.settings.rightYAxis.min || 0;
                let maxr = this.settings.rightYAxis.max || d3.max(data, function (d: any) { return d.rightValue; });
                yl.domain([minl, maxl]);
                yr.domain([minr, maxr]);

                // Render

                this.svg.attr('width', options.viewport.width);
                this.svg.attr('height', options.viewport.height);

                this.chart.attr('transform', 'translate(0, ' + legendHeight + ')');
                this.chartArea
                    .attr('x', yAxisWidth)
                    .attr('y', legendHeight)
                    .attr('width', width)
                    .attr('height', height);

                let days = (<any>data[data.length - 1].date - <any>data[0].date) / 1000 / 60 / 60 / 24;
                let xAxisFormatString = days > 365 ? '%Y' : '%b %Y';
                let xAxisTicks = days > 365 ? d3.time.years : d3.time.months;
                let xAxis = d3.svg.axis().orient('bottom')
                    .scale(xt)
                    .tickFormat(d3.time.format(xAxisFormatString))
                    .ticks(xAxisTicks);

                let leftYAxis = d3.svg.axis().scale(yl).orient('left').ticks(5)
                    .tickSize(-width);
                let rightYAxis = d3.svg.axis().scale(yr).orient('right').ticks(5)
                    .tickSize(0);

                let leftFormat = d3.max(leftMeasure.values) > 1 ? 'unit' : 'percentage';
                leftYAxis.tickFormat(formatMeasure(leftFormat, 1));
                let rightFormat = d3.max(rightMeasure.values) > 1 ? 'unit' : 'percentage';
                rightYAxis.tickFormat(formatMeasure(rightFormat, 1));

                this.xAxis
                    .attr('transform', 'translate(' + yAxisWidth + ', ' + height + ')')
                    .call(xAxis);

                this.leftYAxis
                    .attr('transform', 'translate(' + yAxisWidth + ', 0)')
                    .call(leftYAxis)
                    .selectAll('.tick text')
                        .attr('dx', '-8px')
                        .attr('fill', this.settings.dataColors.left);
                this.rightYAxis
                    .attr('transform', 'translate(' + (width + yAxisWidth) + ', 0)')
                    .call(rightYAxis)
                    .selectAll('.tick text')
                        .attr('dx', '8px')
                        .attr('fill', this.settings.dataColors.right);

                let leftLine = d3.svg.line()
                    .x(function (d: any) { return xt(d.date); })
                    .y(function (d: any) { return yl(d.leftValue); });
                let rightLine = d3.svg.line()
                    .x(function (d: any) { return xt(d.date); })
                    .y(function (d: any) { return yr(d.rightValue); });

                this.leftLine.datum(data).attr('d', <any>leftLine)
                    .attr('transform', 'translate(' + yAxisWidth + ', 0)')
                    .style('stroke', this.settings.dataColors.left);
                this.rightLine.datum(data).attr('d', <any>rightLine)
                    .attr('transform', 'translate(' + yAxisWidth + ', 0)')
                    .style('stroke', this.settings.dataColors.right);

                let leftLegend = this.leftLegend
                    .attr('transform', 'translate(' + (yAxisWidth / 2) + ', 10)');
                leftLegend.append('circle')
                    .attr('cx', 0)
                    .attr('cy', 0)
                    .attr('r', 5)
                    .attr('fill', this.settings.dataColors.left);
                leftLegend.append('text')
                    .attr('dx', '10px')
                    .attr('dy', '0.3em')
                    .text(leftMeasure.source.displayName);

                let rightLegend = this.rightLegend
                    .attr('transform', 'translate(' + (yAxisWidth * 1.5 + width) + ', 10)')
                rightLegend.append('circle')
                    .attr('cx', 0)
                    .attr('cy', 0)
                    .attr('r', 5)
                    .attr('fill', this.settings.dataColors.right);
                rightLegend.append('text')
                    .attr('text-anchor', 'end')
                    .attr('dx', '-10px')
                    .attr('dy', '0.3em')
                    .text(rightMeasure.source.displayName);

                // Interaction

                let bisectDate = d3.bisector(function (d: any) { return d.date; }).left;
                let hoverLine = this.hoverLine;
                let leftActive = this.leftActive;
                let rightActive = this.rightActive;
                let tooltipService = this.host.tooltipService;
                let leftColor = this.settings.dataColors.left;
                let rightColor = this.settings.dataColors.right;

                this.hoverLine
                    .attr('x1', 0)
                    .attr('y1', 0)
                    .attr('x2', 0)
                    .attr('y2', height);

                this.chartArea
                    .on('mouseover', function () {
                        let coordinates = d3.mouse(this);
                        let x0 = xt.invert(coordinates[0] - yAxisWidth);
                        let i = bisectDate(data, x0, 0);
                        let d = data[i];
                        hoverLine
                            .style('display', 'block');
                        leftActive
                            .style('display', 'block')
                            .attr('fill', leftColor);
                        rightActive
                            .style('display', 'block')
                            .attr('fill', rightColor);
                        tooltipService.show({
                            coordinates: [coordinates[0], coordinates[1]],
                            isTouchEvent: false,
                            dataItems: getTooltipData(
                                {
                                    metric: leftMeasure.source.displayName,
                                    format: leftFormat,
                                    color: leftColor
                                },
                                {
                                    metric: rightMeasure.source.displayName,
                                    format: rightFormat,
                                    color: rightColor
                                },
                                d),
                            identities: []
                        });
                    })
                    .on('mouseout', function () {
                        hoverLine.style('display', 'none');
                        leftActive.style('display', 'none');
                        rightActive.style('display', 'none');
                        tooltipService.hide({
                            isTouchEvent: false,
                            immediately: false
                        });
                    })
                    .on('mousemove', function () {
                        let coordinates = d3.mouse(this);
                        let x0 = xt.invert(coordinates[0] - yAxisWidth);
                        let i = bisectDate(data, x0, 0);
                        let d = data[i];
                        hoverLine
                            .attr('x1', xt(<any>d.date) + yAxisWidth)
                            .attr('x2', xt(<any>d.date) + yAxisWidth);
                        leftActive
                            .attr('cx', xt(<any>d.date) + yAxisWidth)
                            .attr('cy', yl(<any>d.leftValue));
                        rightActive
                            .attr('cx', xt(<any>d.date) + yAxisWidth)
                            .attr('cy', yr(<any>d.rightValue));
                        tooltipService.move({
                            coordinates: [coordinates[0], coordinates[1]],
                            isTouchEvent: false,
                            dataItems: getTooltipData(
                                {
                                    metric: leftMeasure.source.displayName,
                                    format: leftFormat,
                                    color: leftColor
                                },
                                {
                                    metric: rightMeasure.source.displayName,
                                    format: rightFormat,
                                    color: rightColor
                                },
                                d),
                            identities: []
                        });
                    });

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
