// config.js 配置文件
window.MapConfig = {
    // 1. 数据文件配置（相对路径）
    dataFiles: {
        geoJson: "data/YXF.geojson",        // GeoJSON地图数据
        
    },
    
    // 2. 地图显示配置
    mapView: {
        center: [35.0, 105.0],  
        minZoom: 17,
        maxZoom: 20,
    },

    featurePoint: {
        url: "data/point.geojson",
        layername: "特点",
    },
    
    // 3. 样式配置
    styles: {
        // 省份默认样式
        default: {
            fillColor: "#4A90E2",    // 蓝色
            color: "#FFFFFF",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.7
        },
        
        // 悬停样式
        hover: {
            fillColor: "#FF6B6B",    // 红色
            color: "#FFFFFF",
            weight: 2,
            fillOpacity: 0.9
        },
        
        // 选中样式
        selected: {
            fillColor: "#2ECC71",    // 绿色
            color: "#FFFFFF",
            weight: 2,
            fillOpacity: 0.9
        }
    },
    
    isMusicPlay : true,
    
    
    // 6. 应用程序设置
    appSettings: {
        enableClickJump: true,      // 点击是否跳转
        autoFitBounds: true,        // 自动适应地图范围
        showScaleControl: true      // 显示比例尺
    },
    
};