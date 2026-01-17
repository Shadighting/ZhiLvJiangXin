// 等待页面DOM加载完成后执行
$(document).ready(function () {

    // 1. 初始化地图，以中国为中心
    var map = L.map('chinaMap').setView([35.0, 105.0], 4);

    // 2. 添加一个底图图层（使用OpenStreetMap）
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 10,
        minZoom: 3
    }).addTo(map);

    // 3. 定义省份的默认和悬停样式[citation:1]
    var defaultStyle = {
        fillColor: "#3388ff", // 填充色
        color: "#fff",        // 边界颜色
        weight: 1.5,          // 边界宽度
        opacity: 1,           // 边界透明度
        fillOpacity: 0.65     // 填充透明度
    };

    var hoverStyle = {
        fillColor: "#ff6b6b", // 悬停时的填充色
        color: "#fff",
        weight: 3,
        fillOpacity: 0.9
    };

    // 4. 存储所有省份图层的引用，便于管理
    var provinceLayers = L.layerGroup().addTo(map);
    var currentHighlightedLayer = null;

    // 5. 模拟的省份信息数据库 (实际项目中可从服务器获取)
    // 键名需与GeoJSON中`properties.name`字段匹配
    var provinceInfoDB = {
        "北京": { shortName: "京", capital: "北京", code: "010", baiduUrl: "https://baike.baidu.com/item/北京" },
        "天津": { shortName: "津", capital: "天津", code: "022", baiduUrl: "https://baike.baidu.com/item/天津" },
        "河北": { shortName: "冀", capital: "石家庄", code: "0311", baiduUrl: "https://baike.baidu.com/item/河北" },
        "山西": { shortName: "晋", capital: "太原", code: "0351", baiduUrl: "https://baike.baidu.com/item/山西" },
        "内蒙古": { shortName: "蒙", capital: "呼和浩特", code: "0471", baiduUrl: "https://baike.baidu.com/item/内蒙古" },
        "辽宁": { shortName: "辽", capital: "沈阳", code: "024", baiduUrl: "https://baike.baidu.com/item/辽宁" },
        "吉林": { shortName: "吉", capital: "长春", code: "0431", baiduUrl: "https://baike.baidu.com/item/吉林" },
        "黑龙江": { shortName: "黑", capital: "哈尔滨", code: "0451", baiduUrl: "https://baike.baidu.com/item/黑龙江" },
        "上海": { shortName: "沪", capital: "上海", code: "021", baiduUrl: "https://baike.baidu.com/item/上海" },
        "江苏": { shortName: "苏", capital: "南京", code: "025", baiduUrl: "https://baike.baidu.com/item/江苏" },
        "浙江": { shortName: "浙", capital: "杭州", code: "0571", baiduUrl: "https://baike.baidu.com/item/浙江" },
        "安徽": { shortName: "皖", capital: "合肥", code: "0551", baiduUrl: "https://baike.baidu.com/item/安徽" },
        "福建": { shortName: "闽", capital: "福州", code: "0591", baiduUrl: "https://baike.baidu.com/item/福建" },
        "江西": { shortName: "赣", capital: "南昌", code: "0791", baiduUrl: "https://baike.baidu.com/item/江西" },
        "山东": { shortName: "鲁", capital: "济南", code: "0531", baiduUrl: "https://baike.baidu.com/item/山东" },
        "河南": { shortName: "豫", capital: "郑州", code: "0371", baiduUrl: "https://baike.baidu.com/item/河南" },
        "湖北": { shortName: "鄂", capital: "武汉", code: "027", baiduUrl: "https://baike.baidu.com/item/湖北" },
        "湖南": { shortName: "湘", capital: "长沙", code: "0731", baiduUrl: "https://baike.baidu.com/item/湖南" },
        "广东": { shortName: "粤", capital: "广州", code: "020", baiduUrl: "https://baike.baidu.com/item/广东" },
        "广西": { shortName: "桂", capital: "南宁", code: "0771", baiduUrl: "https://baike.baidu.com/item/广西" },
        "海南": { shortName: "琼", capital: "海口", code: "0898", baiduUrl: "https://baike.baidu.com/item/海南" },
        "重庆": { shortName: "渝", capital: "重庆", code: "023", baiduUrl: "https://baike.baidu.com/item/重庆" },
        "四川": { shortName: "川/蜀", capital: "成都", code: "028", baiduUrl: "https://baike.baidu.com/item/四川" },
        "贵州": { shortName: "黔/贵", capital: "贵阳", code: "0851", baiduUrl: "https://baike.baidu.com/item/贵州" },
        "云南": { shortName: "云/滇", capital: "昆明", code: "0871", baiduUrl: "https://baike.baidu.com/item/云南" },
        "西藏": { shortName: "藏", capital: "拉萨", code: "0891", baiduUrl: "https://baike.baidu.com/item/西藏" },
        "陕西": { shortName: "陕/秦", capital: "西安", code: "029", baiduUrl: "https://baike.baidu.com/item/陕西" },
        "甘肃": { shortName: "甘/陇", capital: "兰州", code: "0931", baiduUrl: "https://baike.baidu.com/item/甘肃" },
        "青海": { shortName: "青", capital: "西宁", code: "0971", baiduUrl: "https://baike.baidu.com/item/青海" },
        "宁夏": { shortName: "宁", capital: "银川", code: "0951", baiduUrl: "https://baike.baidu.com/item/宁夏" },
        "新疆": { shortName: "新", capital: "乌鲁木齐", code: "0991", baiduUrl: "https://baike.baidu.com/item/新疆" },
        "台湾": { shortName: "台", capital: "台北", code: "0886", baiduUrl: "https://baike.baidu.com/item/台湾" },
        "香港": { shortName: "港", capital: "香港", code: "0852", baiduUrl: "https://baike.baidu.com/item/香港" },
        "澳门": { shortName: "澳", capital: "澳门", code: "0853", baiduUrl: "https://baike.baidu.com/item/澳门" }
    };

    // 6. 加载本地的GeoJSON数据并添加到地图[citation:1][citation:3]
    $.getJSON("china_provinces.geojson", function (geoJsonData) {

        console.log("=== GeoJSON中的省份名称 ===");
    geoJsonData.features.forEach(function(feature, index) {
        console.log(index + ": " + feature.properties.name);
    });
        // 使用Leaflet的geoJSON方法创建图层，并应用样式和交互[citation:1]
        var geoJsonLayer = L.geoJSON(geoJsonData, {
            style: defaultStyle, // 应用默认样式
            onEachFeature: function (feature, layer) {
                // 为每一个省份要素（feature）执行此函数
                var provinceName = feature.properties.name; // 从GeoJSON属性中获取省份名

                // 将图层添加到管理的图层组中
                provinceLayers.addLayer(layer);

                // 绑定鼠标悬停事件[citation:1][citation:10]
                layer.on('mouseover', function (e) {
                    if (currentHighlightedLayer !== this) {
                        this.setStyle(hoverStyle);
                        this.bringToFront(); // 将悬停的省份置顶
                        // updateSidePanel(provinceName);
                    }
                });

                layer.on('mouseout', function (e) {
                    if (currentHighlightedLayer !== this) {
                        this.setStyle(defaultStyle); // 恢复默认样式
                        // 注意：这里不清除侧边栏，保留最后一次悬停或点击的信息
                    }
                });

                // 绑定点击事件[citation:8][citation:9]
                layer.on('click', function (e) {
                    // 清除之前高亮的省份样式
                    if (currentHighlightedLayer && currentHighlightedLayer !== this) {
                        currentHighlightedLayer.setStyle(defaultStyle);
                    }
                    // 高亮当前点击的省份
                    this.setStyle({
                        fillColor: "#2ecc71", // 点击后的颜色
                        color: "#fff",
                        weight: 3,
                        fillOpacity: 0.9
                    });
                    this.bringToFront();
                    currentHighlightedLayer = this;

                    // 更新侧边栏信息
                    updateSidePanel(provinceName);

                    // 触发页面跳转（这里以打开新标签页为例）[citation:8]
                    var info = provinceInfoDB[provinceName];
                    if (info && info.baiduUrl) {
                        // 在实际应用中，这里可以是 window.open，也可以是通过侧边栏的链接点击
                        console.log("准备跳转到: ", info.baiduUrl);
                        // 此处将链接赋给侧边栏的按钮，由用户点击跳转，避免自动跳转干扰体验
                        $('#provinceLink').attr('href', info.baiduUrl).show();
                    }
                });

                // 绑定一个简单的工具提示（在鼠标位置显示省份名）[citation:1]
                layer.bindTooltip(provinceName, {
                    permanent: false, // 不永久显示
                    direction: 'top', // 显示在要素上方
                    offset: [0, -5], // 偏移量
                    className: 'province-tooltip' // 自定义CSS类
                });
            }
        }).addTo(map); // 将整个GeoJSON图层添加到地图

        console.log("中国省份地图数据加载完成！");
    }).fail(function (jqxhr, textStatus, error) {
        // 数据加载失败处理
        console.error("加载GeoJSON数据失败: ", textStatus, error);
        alert('地图数据加载失败，请检查网络或数据文件路径。');
    });

    // 7. 更新侧边栏信息的函数
    function updateSidePanel(provinceName) {
        var info = provinceInfoDB[provinceName];
        if (info) {
            $('#provinceName').text(provinceName);
            $('#provinceShortName').text(info.shortName);
            $('#provinceCapital').text(info.capital);
            $('#provinceCode').text(info.code);
            // 设置百度百科链接
            $('#provinceLink').attr('href', info.baiduUrl).show();
        } else {
            // 如果数据库中没有该省份信息，显示默认内容
            $('#provinceName').text(provinceName);
            $('#provinceShortName').text('信息缺失1');
            $('#provinceCapital').text('信息缺失2');
            $('#provinceCode').text('信息缺失3');
            $('#provinceLink').hide();
        }
    }

    // 8. 添加地图比例尺控件
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
});