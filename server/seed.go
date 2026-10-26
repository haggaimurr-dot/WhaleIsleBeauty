package main

// 基础资料的初始数据，和前端 mock.ts 保持一致。第一次启动时写进 catalog 表，之后由店主在小程序里维护（catalog.go）。

var slotTimes = []string{"09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00", "19:30"}

var seedArtists = []Artist{
	{ID: "a1", Name: "小鲸", Title: "主理人", Years: 8, Avatar: "placeholder:g1"},
	{ID: "a2", Name: "安安", Years: 6, Specialty: "擅长新娘", Avatar: "placeholder:g4"},
	{ID: "a3", Name: "七七", Years: 4, Specialty: "擅长日常", Avatar: "placeholder:g3"},
}

var seedServices = []Service{
	{
		ID: "s1", Name: "韩式上镜妆（含发型）", Summary: "适合拍照、证件照", Category: "camera",
		DurationMin: 90, Price: 29800, Deposit: 5000,
		Includes: []string{"妆前护肤和底妆", "眼妆、修容、唇妆", "简单盘发或卷发", "假睫毛可选，不另收费"},
		Steps: []string{
			"先聊拍什么、穿什么，看一眼衣服颜色",
			"卸妆洁面，按肤质做妆前护肤和保湿",
			"薄涂底妆，局部遮瑕，镜头下不卡粉",
			"眼妆、修容、唇妆，按脸型调整轮廓",
			"盘发或卷发，最后对着手机镜头确认一遍",
		},
		Tags:  []string{"拍照不假面", "氧气感底妆", "含简单盘发"},
		Cover: "placeholder:g2", Images: []string{"placeholder:g2", "placeholder:g6", "placeholder:g4"}, BookedCount: 128,
	},
	{
		ID: "s2", Name: "日常约会妆", Summary: "可教你日常怎么画", Category: "date",
		DurationMin: 60, Price: 16800, Deposit: 3000,
		Includes: []string{"妆前护肤和底妆", "眼妆和唇妆", "化妆师讲解日常画法"},
		Steps: []string{
			"先看看你平时怎么画、手边有哪些化妆品",
			"妆前护肤，底妆只做薄薄一层",
			"画一边眼妆给你看，另一边你自己试着画",
			"唇妆和腮红，选适合日常的颜色",
			"把用到的步骤和产品写给你带走",
		},
		Tags:  []string{"近看也干净", "可学可带走"},
		Cover: "placeholder:g4", Images: []string{"placeholder:g4", "placeholder:g2"}, BookedCount: 96,
	},
	{
		ID: "s3", Name: "新娘跟妆", Summary: "需提前沟通，含试妆一次", Category: "bridal",
		DurationMin: 180, Price: 128000, PriceFrom: true, Deposit: 30000,
		Includes: []string{"试妆一次", "婚礼当天早妆", "全天跟妆补妆", "造型更换两次"},
		Steps: []string{
			"婚礼前一个月左右约一次沟通，聊流程和造型",
			"试妆一次，定下妆面、发型和头饰",
			"婚礼当天早上按时间表上门或到店化妆",
			"全天跟妆，敬酒、换装时补妆和换造型",
		},
		Tags:  []string{"持妆一整天", "含试妆"},
		Cover: "placeholder:g3", Images: []string{"placeholder:g3", "placeholder:g1"}, BookedCount: 41,
	},
	{
		ID: "s4", Name: "主持/年会妆", Summary: "适合舞台灯光", Category: "host",
		DurationMin: 90, Price: 23800, Deposit: 5000,
		Includes: []string{"舞台底妆", "立体修容", "眼妆和唇妆", "简单发型"},
		Steps: []string{
			"先问清楚舞台灯光和站位远近",
			"妆前控油，底妆选不反光的质地",
			"修容和眼妆加重一些，远处看也有轮廓",
			"唇妆、发型，最后定妆",
		},
		Tags:  []string{"舞台灯光下", "上镜不反光"},
		Cover: "placeholder:g5", Images: []string{"placeholder:g5"}, BookedCount: 57,
	},
}

var seedWorks = []Work{
	{ID: "w1", Title: "氧气上镜妆", Category: "camera", ArtistID: "a1", ServiceID: "s1", Image: "placeholder:g2", Ratio: 1.25, DurationText: "约 90 分钟", Featured: true},
	{ID: "w2", Title: "清透约会妆", Category: "date", ArtistID: "a3", ServiceID: "s2", Image: "placeholder:g4", Ratio: 1.5, DurationText: "约 60 分钟"},
	{ID: "w3", Title: "中式新娘妆", Category: "bridal", ArtistID: "a2", ServiceID: "s3", Image: "placeholder:g3", Ratio: 1.6, DurationText: "需提前沟通", Featured: true},
	{ID: "w4", Title: "年会主持妆", Category: "host", ArtistID: "a1", ServiceID: "s4", Image: "placeholder:g5", Ratio: 1.3, DurationText: "约 90 分钟", Featured: true},
	{ID: "w5", Title: "毕业照妆", Category: "camera", ArtistID: "a3", ServiceID: "s1", Image: "placeholder:g6", Ratio: 1.45, DurationText: "约 75 分钟"},
	{ID: "w6", Title: "韩式新娘妆", Category: "bridal", ArtistID: "a2", ServiceID: "s3", Image: "placeholder:g1", Ratio: 1.25, DurationText: "需提前沟通"},
	{ID: "w7", Title: "面试淡妆", Category: "date", ArtistID: "a3", ServiceID: "s2", Image: "placeholder:g2", Ratio: 1.4, DurationText: "约 45 分钟"},
	{ID: "w8", Title: "证件照妆", Category: "camera", ArtistID: "a1", ServiceID: "s1", Image: "placeholder:g4", Ratio: 1.2, DurationText: "约 60 分钟"},
}

// 演示用的化妆品清单，店主在小程序里改
var seedProducts = []Product{
	{ID: "p1", Category: "prep", Brand: "雅漾", Name: "舒泉调理喷雾", Note: "敏感肌可用"},
	{ID: "p2", Category: "prep", Brand: "理肤泉", Name: "B5 修复霜", Note: "干皮上妆前先用它保湿"},
	{ID: "p3", Category: "base", Brand: "雅诗兰黛", Name: "DW 持妆粉底液", Note: "持妆久，新娘和主持妆用"},
	{ID: "p4", Category: "base", Brand: "NARS", Name: "超方瓶粉底液", Note: "轻薄，上镜和日常妆用"},
	{ID: "p5", Category: "base", Brand: "Laura Mercier", Name: "柔光透明散粉", Note: "定妆"},
	{ID: "p6", Category: "eye", Brand: "植村秀", Name: "砍刀眉笔"},
	{ID: "p7", Category: "eye", Brand: "3CE", Name: "九色眼影盘"},
	{ID: "p8", Category: "eye", Brand: "KISSME", Name: "纤长睫毛膏", Note: "防水，哭了也不晕"},
	{ID: "p9", Category: "lip", Brand: "MAC", Name: "子弹头口红", Note: "每位客人用一次性唇刷取用"},
	{ID: "p10", Category: "lip", Brand: "NARS", Name: "腮红"},
	{ID: "p11", Category: "remover", Brand: "贝德玛", Name: "舒妍卸妆水", Note: "无酒精，敏感肌可用"},
}

// 地址取自原型；电话和坐标是演示用的假数据
var seedShop = Shop{
	Name: "鲸屿美妆", Address: "蓝山CBD 3329", Phone: "020-0000-0000", OpenHours: "09:00–21:00",
	Latitude: 23.1291, Longitude: 113.2644,
}

func isSlotTime(t string) bool {
	for _, s := range slotTimes {
		if s == t {
			return true
		}
	}
	return false
}

// seedCourses 演示用的两门课，和 mock.ts 的 c1、c2 一样（顾客讲师的 c3 要先有讲师，不放）。
// 视频是 placeholder:v1 / v2 占位，小程序里按演示视频播放；店主传了真视频后改掉或删掉就好
var seedCourses = []courseRec{
	{ID: "c1", CourseInput: CourseInput{
		Title: "五分钟通勤妆", Summary: "赶时间也来得及的日常妆，跟着画一遍就会", Category: "date", Cover: "placeholder:g4",
		ArtistID: "a3", ServiceID: "s2",
		Chapters: []Chapter{
			{Title: "准备", Lessons: []Lesson{
				{ID: "l1", Title: "妆前护肤怎么做", Video: "placeholder:v1", DurationSec: 240, ProductIDs: []string{"p1", "p2"}},
			}},
			{Title: "上妆", Lessons: []Lesson{
				{ID: "l2", Title: "底妆只用一支", Video: "placeholder:v1", DurationSec: 420, ProductIDs: []string{"p4", "p5"}},
				{ID: "l3", Title: "眉毛和睫毛", Video: "placeholder:v1", DurationSec: 360, ProductIDs: []string{"p6", "p8"}},
				{ID: "l4", Title: "唇颊一支搞定", Video: "placeholder:v1", DurationSec: 180, ProductIDs: []string{"p9", "p10"}},
			}},
		},
		Products: []CourseProductRef{
			{ProductID: "p1", Tip: "先喷一层，等它吸收"}, {ProductID: "p2", Tip: "干皮多抹一点"},
			{ProductID: "p4", Tip: "挤一颗黄豆大就够"}, {ProductID: "p5"}, {ProductID: "p6"}, {ProductID: "p8"},
			{ProductID: "p9", Tip: "也可以点在脸颊当腮红"}, {ProductID: "p10"},
		},
	}},
	{ID: "c2", CourseInput: CourseInput{
		Title: "上镜底妆不假面", Summary: "拍照灯光下也自然的底妆，证件照不用愁", Category: "camera", Cover: "placeholder:g2",
		ArtistID: "a1", ServiceID: "s1",
		Chapters: []Chapter{{Title: "底妆", Lessons: []Lesson{
			{ID: "l5", Title: "先看清自己的肤质", Video: "placeholder:v2", DurationSec: 300, ProductIDs: []string{}},
			{ID: "l6", Title: "粉底怎么推开", Video: "placeholder:v2", DurationSec: 540, ProductIDs: []string{"p3", "p4"}},
			{ID: "l7", Title: "定妆不卡粉", Video: "placeholder:v2", DurationSec: 300, ProductIDs: []string{"p5"}},
		}}},
		Products: []CourseProductRef{{ProductID: "p3", Tip: "要持妆一整天的时候用"}, {ProductID: "p4", Tip: "日常和拍照用它，更轻薄"}, {ProductID: "p5"}},
	}},
}
