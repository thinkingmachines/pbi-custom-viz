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
        private svg: Selection<HTMLElement>;
        private chart: Selection<HTMLElement>;
        private xAxis: Selection<HTMLElement>;
        private leftYAxis: Selection<HTMLElement>;
        private leftLine: Selection<HTMLElement>;
        private leftLegend: Selection<HTMLElement>;
        private rightYAxis: Selection<HTMLElement>;
        private rightLine: Selection<HTMLElement>;
        private rightLegend: Selection<HTMLElement>;

        private host: IVisualHost;
        private selectionManager: ISelectionManager;

        private tooltipServiceWrapper: ITooltipServiceWrapper;

        constructor (options: VisualConstructorOptions) {
            this.target = d3.select(options.element);

            this.svg = this.target.append('svg');
            this.chart = this.svg.append('g')
                .attr('class', 'chart');
            this.xAxis = this.chart.append('g')
                .attr('class', 'x axis');

            this.leftYAxis = this.chart.append('g')
                .attr('class', 'y axis');
            this.leftLine = this.chart.append('path');

            this.rightLine = this.chart.append('path');
            this.rightYAxis = this.chart.append('g')
                .attr('class', 'y axis');

            this.leftLegend = this.svg.append('g')
                .attr('class', 'legend');
            this.rightLegend = this.svg.append('g')
                .attr('class', 'legend');

            this.host = options.host;
            this.selectionManager = options.host.createSelectionManager();

            this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, options.element);;
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

                let legendHeight = 20;
                let xAxisHeight = 40;
                let yAxisWidth = 40;
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

                let xAxis = d3.svg.axis().orient('bottom')
                    .scale(xt)
                    .tickFormat(d3.time.format('%b %Y'))
                    .ticks(2);

                let leftYAxis = d3.svg.axis().scale(yl).orient('left').ticks(5)
                    .tickSize(-width);
                let rightYAxis = d3.svg.axis().scale(yr).orient('right').ticks(5)
                    .tickSize(0);

                let leftFormat = d3.max(leftMeasure.values) > 1 ? 'unit' : 'percentage';
                leftYAxis.tickFormat(formatMeasure(leftFormat, 1));
                let rightFormat = d3.max(rightMeasure.values) > 1 ? 'unit' : 'percentage';
                rightYAxis.tickFormat(formatMeasure(rightFormat, 1));

                this.xAxis
                    .attr('transform', 'translate(' + yAxisWidth + ', ' + (height + 20) + ')')
                    .call(xAxis);

                this.leftYAxis
                    .attr('transform', 'translate(' + yAxisWidth + ', 20)')
                    .call(leftYAxis)
                    .selectAll('.tick text')
                        .attr('fill', this.settings.dataColors.left);
                this.rightYAxis
                    .attr('transform', 'translate(' + (width + yAxisWidth) + ', 20)')
                    .call(rightYAxis)
                    .selectAll('.tick text')
                        .attr('fill', this.settings.dataColors.right);

                let leftLine = d3.svg.line()
                    .x(function (d: any) { return xt(d.date); })
                    .y(function (d: any) { return yl(d.leftValue); });
                let rightLine = d3.svg.line()
                    .x(function (d: any) { return xt(d.date); })
                    .y(function (d: any) { return yr(d.rightValue); });

                this.leftLine.datum(data).attr('d', <any>leftLine)
                    .attr('transform', 'translate(' + yAxisWidth + ', 20)')
                    .style('stroke', this.settings.dataColors.left);
                this.rightLine.datum(data).attr('d', <any>rightLine)
                    .attr('transform', 'translate(' + yAxisWidth + ', 20)')
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
