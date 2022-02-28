var topSixCountriesHistoricCache = null;
var allCountriesSnapshotCache = null;
var mapDataCache = null;
var USStatesCache = null;
var summarisedDataCache = null;
var isShowingStatesMap = false;
var apiEntry = 'https://disease.sh/v3/covid-19';
var fetchPeriod = '90'

// This function is called after Google Charts successfully loaded.
function main(){
    fetchAndUpdateSummarisedData();
    fetchAndUpdateCountriesSnapshot();

    // https://stackoverflow.com/questions/5489946/how-to-wait-for-the-end-of-resize-event-and-only-then-perform-an-action
    // https://stackoverflow.com/questions/17328742/mobile-chrome-fires-resize-event-on-scroll
    var doit;
    var width = $(window).width(), height = $(window).height();

    window.onresize = function(e){
        clearTimeout(doit);
        if($(window).width() != width || $(window).height() != height){
            doit = setTimeout(resizedw, 100);
        }
    }
}

function updateFetchPeriod(period){
    fetchPeriod = period;
    topSixCountriesHistoricCache = null;
    fetchAndUpdateCountriesSnapshot();
}

function resizedw(){
    // Haven't resized in 100ms!
    if(isShowingStatesMap){
        fetchAndDrawUSMap();
    }else{
        drawWorldMap(mapDataCache);
    }
}

function fetchAndUpdateSummarisedData(){
    fetch(`${apiEntry}/all?yesterday=true`)
        .then(response => response.json())
        .then(data => {
            summarisedDataCache = data;
            document.getElementById("summarised.cases").innerText = numberInMillions(data.cases);
            document.getElementById("summarised.deaths").innerText = numberInMillions(data.deaths);
            document.getElementById("summarised.recovered").innerText = numberInMillions(data.recovered);
            document.getElementById("summarised.todayCases").innerHTML = 'Cases <span style="color:#4c8bf1;">+' + numberWithCommas(data.todayCases) + '</span>';
            document.getElementById("summarised.todayDeaths").innerHTML = 'Deaths <span style="color: #d9453d;">+' + numberWithCommas(data.todayDeaths) + '</span>';
            document.getElementById("summarised.todayRecovered").innerHTML = 'Recovered <span style="">+' + numberWithCommas(data.todayRecovered) + '</span>';
            document.getElementById("last.updated").innerText = new Date(data.updated).toLocaleString();
        });    
}

function drawWorldMap(snapshot, country=null) {
    var data = google.visualization.arrayToDataTable(snapshot);

    var options = {
        legend: "none",
        datalessRegionColor: "#EEEEEE",
        colorAxis: {
        colors: ["#d3e3fb", "#8cb5f6", "#4688f1", "#1f6bcf", "#1b50a4"],
        },
        backgroundColor: {
        fill: "transparent",
        },
        domain: "IN",
    };

    if(country != null){
        options['region'] = country;
        options['resolution'] = 'provinces';
        options['displayMode'] = 'regions';
        isShowingStatesMap = true;
    }else{
        isShowingStatesMap = false;
    }

    var chart = new google.visualization.GeoChart(document.getElementById("regions_div"));

    chart.draw(data, options);
}

function drawMiniChart(data, isDelta){
    document.getElementById('countries.miniChart').innerHTML = '';
    for(country of data){
        var chartId = "miniChart." + country.country;

        document.getElementById('countries.miniChart').innerHTML += (
            '<div class="col-xs-3 mr-2"><h5>' +
            country.country +
            ' ' +
            getFlagEmoji(country.iso2) +
            '│<span style="color:#4c8bf1;">' +
            '+' +
            numberWithCommas(country.todayCases) +
            '</span>│<span style="color:#d9453d;">' +
            '+' +
            numberWithCommas(country.todayDeaths) +
            '</span></h5><div id="' +
            chartId +
            '" style="width:250px;"></div></div>'
        );
    }
    for(country of data){
        var chartId = "miniChart." + country.country;
        drawChart(chartId, country.timeline.cases, isDelta);
    }
}

function drawChart(chartId, timelineSeries, isDelta, title=null){
    var parsedData = Object.keys(timelineSeries).map(x => {return [x, timelineSeries[x]]});

    if(isDelta){
        parsedData = parsedData.slice(1).map((item, index) => {return [item[0], Math.max(item[1] - parsedData[index][1], 0)]});
    }
    var chartData = google.visualization.arrayToDataTable([['Date', 'Cases']].concat(parsedData));

    var options = {
        legend: {
            position: "none",
        },
        hAxis: {
            title: "",
            format: "M/d",
        },
        chartArea: {
            width: "100%",
            height: "100%",
        },
        backgroundColor: {
            fill: "transparent",
        },
        chartArea: {
            backgroundColor: {
            fill: "transparent",
            },
        },
        width: "100%",
        bars: "vertical",
    };

    if(title != null){
        options = {
            title: title,
            legend: {
                position: "none",
            },
            hAxis: {
                format: "M/d",
            },
            backgroundColor: {
                fill: "transparent",
            },
            chartArea: {
                backgroundColor: {
                fill: "transparent",
                },
            },
            height: "400",
            bars: "vertical",
        };
    }
    var chart = null;

    if (isDelta) {
        chart = new google.charts.Bar(document.getElementById(chartId));
        chart.draw(chartData, google.charts.Bar.convertOptions(options));
    } else {
        chart = new google.charts.Line(document.getElementById(chartId));
        chart.draw(chartData, google.charts.Line.convertOptions(options));
    }
}

function fetchAndDrawUSMap(){
    if(USStatesCache){
        drawWorldMap(USStatesCache, 'US');
        return;
    }
    fetch(`${apiEntry}/states?yesterday=true&allowNull=false`)
    .then(response => response.json())
    .then(data => {
        var mapData = [['State','Cases']];
        for(state of data){
            mapData.push([{v: state.state, f: state.state}, {v: state.casesPerOneMillion, f: `${numberWithCommas(state.cases)} (+${numberWithCommas(state.todayCases)})`}])
        }
        USStatesCache = mapData;
        drawWorldMap(mapData, 'US');
    })
}

function showDetailedModal(country){
    document.getElementById('modal.body').innerHTML = '';
    $("#exampleModal").modal('toggle');
    $("#exampleModal").one("shown.bs.modal", function () {
        var countryURL = country;
        if(country === 'HK'){
            countryURL = 'CN/Hong%20Kong';
        }
        fetch(`${apiEntry}/historical/${countryURL}?lastdays=${fetchPeriod}`)
        .then(response => response.json())
        .then(data => {
            var charts = ['detailed.chart.cases', 'detailed.chart.deaths'];
            for(chart of charts){
                var element = document.createElement('div');
                element.className = 'chart';
                element.id = chart;
                document.getElementById('modal.body').appendChild(element);
            }
            var countryToDisplay = data.country;
            if(country === `HK`){
                countryToDisplay = 'Hong Kong'
            }
            drawChart(charts[0], data.timeline.cases, true, `Daily Cases - ${countryToDisplay} ${getFlagEmoji(country)}`);
            drawChart(charts[1], data.timeline.deaths, true, `Daily Deaths - ${countryToDisplay} ${getFlagEmoji(country)}`);
        })
        .catch(err => {
            var element = document.createElement('h5');
            element.innerText = "Country not found or doesn't have any historical data";
            document.getElementById('modal.body').appendChild(element);
        })
    })
    
    
}

function drawDetailedTable(data, sortByKey='todayCases'){
    data = data.sort((a, b) => b[sortByKey] - a[sortByKey]);
    document.getElementById("country_data_rows").innerHTML = '';
    for(country of data){
        document.getElementById("country_data_rows").innerHTML += (
            '<tr><th scope="row" class="text-left"><h4><a href="javascript:void(0);" onClick="showDetailedModal(&quot;' +
            country.countryInfo.iso2 +
            '&quot;)">' +
            country.country +
            '</a></h4></th><td><h4 class="text-center">' +
            numberWithCommas(country.cases) +
            '</h4></td><td><h4 class = "text-center">' +
            numberWithCommas(country.deaths) +
            '</h4></td><td><h4 class = "text-center" style="color:#4c8bf1;">+' +
            numberWithCommas(country.todayCases) +
            '</h4></td><td><h4 class = "text-center" style="color: #d9453d">+' +
            numberWithCommas(country.todayDeaths) +
            '</h4></td><td><h4 class = "text-center">' +
            numberWithCommas(country.active) +
            '</h4></td><td><h4 class = "text-center">' +
            numberWithCommas(country.recovered) +
            '</h4></td><td><h4 class = "text-center">' +
            numberWithCommas(country.casesPerOneMillion) +
            '</h4></td><td><h4 class = "text-center">' +
            numberWithCommas(country.deathsPerOneMillion) +
            '</h4></td><td><h4 class = "text-center">' +
            numberWithCommas(country.testsPerOneMillion) +
            "</h4></td></tr>"
        );
    }
}

function drawTickerTape(snapshot){
    var snapshot = snapshot.sort((a, b) => b.todayCases - a.todayCases).slice(0,20);

    for(country of snapshot){
        document.getElementById("ticker_tape").innerHTML += (
            '<div class="col-xs-3 mr-2" style="width: fit-content;"><h5><a href="javascript:void(0);" onClick="showDetailedModal(&quot;'+ country.iso2 +'&quot;)">' +
            getFlagEmoji(country.iso2) +
            '<span style="color:#4c8bf1;"> +' +
            numberWithCommas(country.todayCases) +
            "</span>" +
            "</a></h5></div>"
        );
    }
}

function drawSanpshot(slicedSnapshot, element){
    element.innerHTML = "";
    for(country of slicedSnapshot){
        var extraInfo = ""

        switch (element.id){
            case "snapshot.topSixNewCases.percentage":
                extraInfo = " (" + country.increasePercentage + "%)</span>";
                break;
            case "snapshot.topSixNewCases.perMillion":
                extraInfo = " (" + Math.round(country.increasePerOneMillion * 100) / 100 + ")</span>"
                break;
            case "snapshot.topSixNewCases":
                extraInfo = ""
                break;
        }

        element.innerHTML += (
            '<div class="col-xs-6 mr-2" style="width: fit-content;"><h5><a href="javascript:void(0);" onClick="showDetailedModal(&quot;' + country.iso2 + '&quot;)">' +
              country.country +
              " " +
              getFlagEmoji(country.iso2) +
              "│" +
              numberWithCommas(country.cases) +
              ' <span style="color:#4c8bf1;"> +' +
              numberWithCommas(country.todayCases) +
              extraInfo +
              "</a></h5></div>"
          );
    }
}

function fetchAndUpdateCountriesSnapshot(){
    fetch(`${apiEntry}/countries?yesterday=true`)
        .then(response => response.json())
        .then(data => {
            var mapData = [['Country','Cases']];
            for(country of data){
                mapData.push([{v: country.countryInfo.iso2, f: country.country}, {v: country.casesPerOneMillion, f: `${numberWithCommas(country.cases)} (+${numberWithCommas(country.todayCases)})`}])
            }
            mapDataCache = mapData;
            drawWorldMap(mapData);
            drawDetailedTable(data);
            allCountriesSnapshotCache = data;

            var snapshot = data.map(x => {return {
                country: x.country,
                cases: x.cases,
                deaths: x.deaths,
                iso2: x.countryInfo.iso2,
                todayCases: x.todayCases,
                todayDeaths: x.todayDeaths,
                increasePerOneMillion: x.todayCases / (x.cases / x.casesPerOneMillion),
                increasePercentage: Math.round(x.todayCases / x.cases * 100)
            }})

            drawTickerTape(snapshot);

            // Locate top 6 countries with largest increase in cases.
            var top6CountriesWithLargestIncreaseInCases = snapshot
                .sort((a, b) => b.todayCases - a.todayCases)
                .slice(0, 6);
            drawSanpshot(top6CountriesWithLargestIncreaseInCases, document.getElementById('snapshot.topSixNewCases'));
            fetchAndUpdateCountriesMiniChart(top6CountriesWithLargestIncreaseInCases, true);

            // Locate top 6 countries with largest increase in cases per 1 million population.
            var top6CountriesWithLargestIncreaseInCasesPerMillion = snapshot
                .sort((a, b) => b.increasePerOneMillion - a.increasePerOneMillion)
                .slice(0, 6);
            drawSanpshot(top6CountriesWithLargestIncreaseInCasesPerMillion, document.getElementById('snapshot.topSixNewCases.perMillion'));

            // Locate top 6 countries with largest percentage increase in cases.
            var top6CountriesWithLargestPercentageIncreaseInCases = snapshot
                .sort((a, b) => b.increasePercentage - a.increasePercentage)
                .slice(0, 6);
            drawSanpshot(top6CountriesWithLargestPercentageIncreaseInCases, document.getElementById('snapshot.topSixNewCases.percentage'));
        })
}

function fetchAndUpdateCountriesMiniChart(snapshot, isDelta){
    if(topSixCountriesHistoricCache){
        drawMiniChart(topSixCountriesHistoricCache, isDelta);
        return;
    }
    var countriesISOs = snapshot.map(x => x.iso2).join('%2C');
    Promise.all([
        fetch(`${apiEntry}/historical/${countriesISOs}?lastdays=${fetchPeriod}`)
            .then((res) => res.json()),
        fetch(`${apiEntry}/historical/all?lastdays=${fetchPeriod}`)
            .then((res) => res.json())
    ]).then(([countries, all]) => {
        for(x in countries){
            snapshot[x].timeline = countries[x].timeline;
        }
        var worldSnapshot = {
            country: 'World',
            countryCode: null,
            timeline: all,
            iso2: null,
            todayCases: summarisedDataCache.todayCases,
            todayDeaths: summarisedDataCache.todayDeaths
        }
        snapshot.unshift(worldSnapshot)

        drawMiniChart(snapshot, isDelta);
        topSixCountriesHistoricCache = snapshot;
    })
}

function numberWithCommas(number){
    return new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 }).format(number);
}

function numberInMillions(number){
    return `${Math.round((number / 1000000) * 100) / 100} M`
}

// From: https://dev.to/jorik/country-code-to-flag-emoji-a21
function getFlagEmoji(countryCode) {
    if(countryCode === null){
        return "🌐";
    }
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char =>  127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
}