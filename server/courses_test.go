package main

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"
)

// 课堂：课程、观看进度、顾客讲师的授权和分成。用例和前端 mock.course.test.ts 对齐。
// 测试时钟在 2026-10-01 10:00，可约 10/2–10/8。

var testCourse = CourseInput{
	Title: " 新娘早妆 ", Summary: "婚礼当天早上怎么配合化妆师", Category: "bridal", Cover: "placeholder:g1",
	ArtistID: "a2", ServiceID: "s3",
	Chapters: []Chapter{{Title: "当天", Lessons: []Lesson{{Title: "素颜过来就好", Video: "placeholder:v1", DurationSec: 120, ProductIDs: []string{"p1"}}}}},
	Products: []CourseProductRef{{ProductID: "p1", Tip: " "}},
}

var testTeacher = TeacherInput{Name: "林小姐", Avatar: "placeholder:g6", Intro: "常来的客人", ShareRate: 20}

// classroom 一位合作中的顾客讲师（林小姐，openid o-lin）和两门课：化妆师七七的 c1、林小姐的 c3
type classroom struct {
	a       *App
	c       *clock
	owner   *User
	lin     *User
	teacher Teacher
	c1, c3  Course
}

func newClassroom(t *testing.T) *classroom {
	t.Helper()
	a, c := newTestApp(t)
	ctx := context.Background()
	r := &classroom{a: a, c: c, owner: user(t, a, ownerOpenID), lin: user(t, a, "o-lin")}
	// 从空的课堂开始，不受初始课程影响（初始课程见 TestSeedCourses）
	for _, id := range []string{"c1", "c2"} {
		if err := a.DeleteCourse(ctx, r.owner, id); err != nil {
			t.Fatal(err)
		}
	}
	inv := must(a.CreateTeacher(ctx, r.owner, testTeacher))
	r.teacher = must(a.AcceptTeacherInvite(ctx, r.lin, inv.InviteCode, AcceptInviteReq{AgreementVersion: TeacherAgreementVersion}))
	r.c1 = must(a.CreateCourse(ctx, r.owner, CourseInput{
		Title: "五分钟通勤妆", Summary: "赶时间也来得及", Category: "date", Cover: "placeholder:g4", ArtistID: "a3", ServiceID: "s2",
		Chapters: []Chapter{
			{Title: "准备", Lessons: []Lesson{{Title: "妆前护肤", Video: "placeholder:v1", DurationSec: 240, ProductIDs: []string{"p1"}}}},
			{Title: "上妆", Lessons: []Lesson{
				{Title: "底妆", Video: "placeholder:v1", DurationSec: 420, ProductIDs: []string{"p4", "p5"}},
				{Title: "眉毛", Video: "placeholder:v1", DurationSec: 360},
			}},
		},
		Products: []CourseProductRef{{ProductID: "p1", Tip: "先喷一层"}, {ProductID: "p4", Tip: "黄豆大就够"}, {ProductID: "p5"}},
	}))
	c.advance(time.Second) // 让 c3 排在前面
	r.c3 = must(a.CreateCourse(ctx, r.owner, CourseInput{
		Title: "单眼皮的眼妆", Summary: "换个画法就好", Category: "date", Cover: "placeholder:g3", TeacherID: r.teacher.ID, ServiceID: "s2",
		Chapters: []Chapter{{Title: "眼妆", Lessons: []Lesson{{Title: "眼影画在哪", Video: "placeholder:v3", DurationSec: 480}}}},
		Products: []CourseProductRef{},
	}))
	return r
}

// bookFrom 从某门课进来，约 a1 某天某时，付定金、店里确认
func (r *classroom) bookFrom(t *testing.T, u *User, courseID, date, tm string) Booking {
	t.Helper()
	ctx := context.Background()
	resp := must(r.a.CreateBooking(ctx, u, CreateBookingReq{ServiceID: "s2", ArtistID: "a1", Date: date, Time: tm, CourseID: courseID}))
	must(r.a.MarkPaid(ctx, u, resp.Booking.ID))
	return must(r.a.ConfirmBooking(ctx, r.owner, resp.Booking.ID))
}

// finish 时钟拨到 at，跑一次自动流转（已确认的过了结束时间算完成）
func (r *classroom) finish(t *testing.T, at time.Time) {
	t.Helper()
	r.c.t = at
	if err := r.a.Sweep(context.Background()); err != nil {
		t.Fatal(err)
	}
}

func (r *classroom) payout(t *testing.T, month string) *Payout {
	t.Helper()
	for _, p := range must(r.a.Payouts(context.Background(), r.owner)) {
		if p.TeacherID == r.teacher.ID && p.Month == month {
			return &p
		}
	}
	return nil
}

func TestCourseRules(t *testing.T) {
	ok := func(c CourseInput) string { return validateCourse(cleanCourse(c)) }
	lesson := func(f func(*Lesson)) CourseInput {
		c := cleanCourse(testCourse)
		f(&c.Chapters[0].Lessons[0])
		return c
	}
	cases := []struct {
		in   CourseInput
		want string
	}{
		{testCourse, ""},
		{CourseInput{Title: "a", Summary: "b", Category: "date", Cover: "x", Chapters: testCourse.Chapters, Products: testCourse.Products}, "还没选讲师"},
		{func() CourseInput { c := testCourse; c.TeacherID = "t1"; return c }(), "讲师只能选一位"},
		{func() CourseInput { c := testCourse; c.Chapters = nil; return c }(), "至少要有一章"},
		{func() CourseInput { c := testCourse; c.Chapters = []Chapter{{Title: "空的"}}; return c }(), "「空的」还没有小节"},
		{lesson(func(l *Lesson) { l.Video = "" }), "「素颜过来就好」还没传视频"},
		{lesson(func(l *Lesson) { l.DurationSec = 3601 }), "「素颜过来就好」的视频要在 60 分钟以内"},
		{lesson(func(l *Lesson) { l.ProductIDs = []string{"p9"} }), "「素颜过来就好」用到的化妆品要先加进本课清单"},
		{func() CourseInput {
			c := testCourse
			c.Products = []CourseProductRef{{ProductID: "p1", Tip: strings.Repeat("字", 41)}}
			return c
		}(), "化妆品用法每条最多 40 个字"},
	}
	for i, tc := range cases {
		if got := ok(tc.in); got != tc.want {
			t.Errorf("case %d: want %q, got %q", i, tc.want, got)
		}
	}
	c := cleanCourse(CourseInput{Products: []CourseProductRef{{ProductID: "p1", Tip: "先"}, {ProductID: "p1", Tip: "后"}}})
	if len(c.Products) != 1 || c.Products[0].Tip != "先" {
		t.Fatalf("dedupe %+v", c.Products)
	}

	tv := func(f func(*TeacherInput)) string {
		v := testTeacher
		f(&v)
		return validateTeacher(cleanTeacher(v))
	}
	if got := tv(func(*TeacherInput) {}); got != "" {
		t.Fatal(got)
	}
	if got := tv(func(v *TeacherInput) { v.Name = " " }); got != "名字还没填" {
		t.Fatal(got)
	}
	if got := tv(func(v *TeacherInput) { v.ShareRate = 51 }); got != "分成比例填 0–50 的整数" {
		t.Fatal(got)
	}
}

func TestCoursesForCustomer(t *testing.T) {
	r := newClassroom(t)
	ctx := context.Background()
	list := must(r.a.Courses(ctx, ""))
	if len(list) != 2 || list[0].ID != r.c3.ID || list[1].ID != r.c1.ID {
		t.Fatalf("order %+v", list)
	}
	if s := list[1]; s.LessonCount != 3 || s.DurationSec != 240+420+360 ||
		s.Teacher != (CourseTeacher{Kind: "artist", Name: "七七", Avatar: "placeholder:g3", Intro: "擅长日常 · 4 年"}) {
		t.Fatalf("summary %+v", s)
	}
	if s := list[0]; s.Teacher.Kind != "customer" || s.Teacher.Name != "林小姐" || s.TeacherID != r.teacher.ID {
		t.Fatalf("customer teacher %+v", s)
	}
	if got := must(r.a.Courses(ctx, "camera")); len(got) != 0 {
		t.Fatalf("filter %+v", got)
	}

	d := must(r.a.Course(ctx, nil, r.c1.ID))
	if len(d.Chapters) != 2 || d.ServiceID != "s2" || d.Progress != nil {
		t.Fatalf("detail %+v", d)
	}
	if d.Products[1].ID != "p4" || d.Products[1].Brand != "NARS" || d.Products[1].Tip != "黄豆大就够" || d.Products[2].Tip != "" {
		t.Fatalf("products %+v", d.Products)
	}

	// 项目下架后客人那边不带 serviceId，店主那边照常带
	s := ownerService(t, r.a, r.owner, "s2")
	s.Hidden = true
	must(r.a.UpdateService(ctx, r.owner, "s2", s))
	if must(r.a.Course(ctx, nil, r.c1.ID)).ServiceID != "" || must(r.a.OwnerCourse(ctx, r.owner, r.c1.ID)).ServiceID != "s2" {
		t.Fatal("hidden service should be dropped for customers only")
	}

	// 删掉化妆品，课里一起去掉
	if err := r.a.DeleteProduct(ctx, r.owner, "p4"); err != nil {
		t.Fatal(err)
	}
	d = must(r.a.Course(ctx, nil, r.c1.ID))
	if len(d.Products) != 2 || strings.Join(d.Chapters[1].Lessons[0].ProductIDs, ",") != "p5" {
		t.Fatalf("after delete product %+v", d)
	}
}

func TestCourseProgress(t *testing.T) {
	r := newClassroom(t)
	ctx := context.Background()
	alice := user(t, r.a, "o-alice")
	l1, l2, l3 := r.c1.Chapters[0].Lessons[0], r.c1.Chapters[1].Lessons[0], r.c1.Chapters[1].Lessons[1]

	p := must(r.a.SaveCourseProgress(ctx, alice, r.c1.ID, SaveProgressReq{LessonID: l2.ID, PositionSec: 100.7}))
	if p.LessonID != l2.ID || p.PositionSec != 100 || len(p.FinishedLessonIDs) != 0 {
		t.Fatalf("progress %+v", p)
	}
	p = must(r.a.SaveCourseProgress(ctx, alice, r.c1.ID, SaveProgressReq{LessonID: l2.ID, PositionSec: 416}))
	p = must(r.a.SaveCourseProgress(ctx, alice, r.c1.ID, SaveProgressReq{LessonID: l3.ID, PositionSec: 9999}))
	if p.PositionSec != 360 || strings.Join(p.FinishedLessonIDs, ",") != l2.ID+","+l3.ID {
		t.Fatalf("progress %+v", p)
	}
	if d := must(r.a.Course(ctx, alice, r.c1.ID)); d.Progress == nil || d.Progress.LessonID != l3.ID {
		t.Fatalf("detail progress %+v", d.Progress)
	}
	if d := must(r.a.Course(ctx, nil, r.c1.ID)); d.Progress != nil {
		t.Fatal("no user, no progress")
	}
	_, err := r.a.SaveCourseProgress(ctx, alice, r.c1.ID, SaveProgressReq{LessonID: "nope", PositionSec: 1})
	wantCode(t, err, "NOT_FOUND")

	// 改课时删掉第一章：在看的小节还在，看完的里面去掉不在的
	must(r.a.SaveCourseProgress(ctx, alice, r.c1.ID, SaveProgressReq{LessonID: l1.ID, PositionSec: 240}))
	must(r.a.SaveCourseProgress(ctx, alice, r.c1.ID, SaveProgressReq{LessonID: l2.ID, PositionSec: 10}))
	in := r.c1Input()
	in.Chapters = in.Chapters[1:]
	must(r.a.UpdateCourse(ctx, r.owner, r.c1.ID, in))
	if d := must(r.a.Course(ctx, alice, r.c1.ID)); d.Progress == nil || d.Progress.LessonID != l2.ID ||
		strings.Join(d.Progress.FinishedLessonIDs, ",") != l2.ID+","+l3.ID {
		t.Fatalf("trimmed %+v", d.Progress)
	}
	// 删掉在看的那一节，进度清掉
	in.Chapters = []Chapter{{Title: "上妆", Lessons: in.Chapters[0].Lessons[1:]}}
	must(r.a.UpdateCourse(ctx, r.owner, r.c1.ID, in))
	if d := must(r.a.Course(ctx, alice, r.c1.ID)); d.Progress != nil {
		t.Fatalf("should be cleared %+v", d.Progress)
	}
}

func (r *classroom) c1Input() CourseInput {
	d := must(r.a.OwnerCourse(context.Background(), r.owner, r.c1.ID))
	in := CourseInput{
		Title: d.Title, Summary: d.Summary, Category: d.Category, Cover: d.Cover, ArtistID: d.ArtistID, ServiceID: d.ServiceID,
		Chapters: d.Chapters, Products: []CourseProductRef{},
	}
	for _, p := range d.Products {
		in.Products = append(in.Products, CourseProductRef{ProductID: p.ID, Tip: p.Tip})
	}
	return in
}

func TestShareFromCourse(t *testing.T) {
	r := newClassroom(t)
	ctx := context.Background()
	alice := user(t, r.a, "o-alice")

	b := r.bookFrom(t, alice, r.c3.ID, "2026-10-03", "10:30")
	r.bookFrom(t, alice, r.c1.ID, "2026-10-03", "12:00") // 化妆师的课：不分成，但记得从哪门课来
	r.bookFrom(t, alice, "", "2026-10-03", "13:30")
	cancelled := r.bookFrom(t, alice, r.c3.ID, "2026-10-04", "10:30")
	must(r.a.OwnerCancelBooking(ctx, r.owner, cancelled.ID))
	r.bookFrom(t, r.lin, r.c3.ID, "2026-10-03", "15:00") // 讲师约自己的课不分成

	day := must(r.a.DaySchedule(ctx, r.owner, "2026-10-03"))
	titles := map[string]string{}
	for _, c := range day.Cells {
		if c.Booking != nil {
			titles[c.Time] = c.Booking.CourseTitle
		}
	}
	if titles["10:30"] != "单眼皮的眼妆" || titles["12:00"] != "五分钟通勤妆" || titles["13:30"] != "" {
		t.Fatalf("course titles %+v", titles)
	}

	// 还没到店不算
	if p := r.payout(t, "2026-10"); p != nil {
		t.Fatalf("not yet %+v", p)
	}
	r.finish(t, time.Date(2026, 10, 5, 10, 0, 0, 0, shanghai))
	p := r.payout(t, "2026-10")
	if p == nil || p.Status != PayoutOpen || p.Count != 1 || p.Amount != 3360 ||
		p.Records[0] != (ShareRecord{BookingID: b.ID, Date: "2026-10-03", ServiceName: "日常约会妆", CourseTitle: "单眼皮的眼妆", Price: 16800, Rate: 20, Amount: 3360}) {
		t.Fatalf("payout %+v", p)
	}

	_, err := r.a.MarkPayoutPaid(ctx, r.owner, r.teacher.ID, "2026-10")
	wantMsg(t, err, "这个月还没过完，月底后再结")
	_, err = r.a.MarkPayoutPaid(ctx, r.owner, r.teacher.ID, "2026-09")
	wantMsg(t, err, "这个月没有要付的分成")

	r.finish(t, time.Date(2026, 11, 2, 10, 0, 0, 0, shanghai))
	if p := r.payout(t, "2026-10"); p == nil || p.Status != PayoutDue {
		t.Fatalf("due %+v", p)
	}
	paid := must(r.a.MarkPayoutPaid(ctx, r.owner, r.teacher.ID, "2026-10"))
	if paid.Status != PayoutPaid || paid.PaidAt == "" || paid.Amount != 3360 {
		t.Fatalf("paid %+v", paid)
	}
	_, err = r.a.MarkPayoutPaid(ctx, r.owner, r.teacher.ID, "2026-10")
	wantMsg(t, err, "这个月已经标记过了")

	// 讲师自己在“我的课堂”里也能看到
	mine := must(r.a.MyTeaching(ctx, r.lin))
	if len(mine.Payouts) != 1 || mine.Payouts[0].Status != PayoutPaid || len(mine.Courses) != 1 || mine.Teacher.InviteCode != "" {
		t.Fatalf("my teaching %+v", mine)
	}
}

func TestShareKeptAfterTeacherEnds(t *testing.T) {
	r := newClassroom(t)
	ctx := context.Background()
	alice := user(t, r.a, "o-alice")
	r.bookFrom(t, alice, r.c3.ID, "2026-10-03", "10:30")
	must(r.a.EndTeacher(ctx, r.owner, r.teacher.ID))
	// 结束后课下架了，带着 courseId 来的也不算
	r.bookFrom(t, alice, r.c3.ID, "2026-10-03", "12:00")
	r.finish(t, time.Date(2026, 10, 5, 10, 0, 0, 0, shanghai))
	if p := r.payout(t, "2026-10"); p == nil || p.Count != 1 {
		t.Fatalf("payout %+v", p)
	}
}

func TestTeacherInvite(t *testing.T) {
	a, _ := newTestApp(t)
	ctx := context.Background()
	owner, zhou := user(t, a, ownerOpenID), user(t, a, "o-zhou")

	inv := must(a.CreateTeacher(ctx, owner, TeacherInput{Name: " 小周 ", Avatar: "placeholder:g5", ShareRate: 15}))
	if inv.Status != TeacherInvited || len(inv.InviteCode) != 8 || inv.Name != "小周" {
		t.Fatalf("invite %+v", inv)
	}
	// 确认前可以改比例
	inv = must(a.UpdateTeacher(ctx, owner, inv.ID, TeacherInput{Name: "小周", Avatar: "placeholder:g5", ShareRate: 12}))
	// 还没确认的讲师的课只能存成下架
	in := testCourse
	in.ArtistID, in.TeacherID = "", inv.ID
	_, err := a.CreateCourse(ctx, owner, in)
	wantMsg(t, err, "TA 还没确认授权，先存成下架，确认后再上架")
	in.Hidden = true
	hidden := must(a.CreateCourse(ctx, owner, in))

	view := must(a.TeacherInvite(ctx, zhou, inv.InviteCode))
	if view.Name != "小周" || view.ShareRate != 12 || view.ShopName != seedShop.Name || view.AgreementVersion != TeacherAgreementVersion {
		t.Fatalf("invite view %+v", view)
	}
	if me := must(a.Me(ctx, zhou)); me.TeacherID != "" {
		t.Fatal("not a teacher yet")
	}
	_, err = a.MyTeaching(ctx, zhou)
	wantCode(t, err, "NOT_FOUND")
	_, err = a.AcceptTeacherInvite(ctx, zhou, inv.InviteCode, AcceptInviteReq{AgreementVersion: "2000-01"})
	wantCode(t, err, "INVALID_STATE")

	got := must(a.AcceptTeacherInvite(ctx, zhou, inv.InviteCode, AcceptInviteReq{AgreementVersion: TeacherAgreementVersion}))
	if got.Status != TeacherActive || got.AgreedAt == "" || got.InviteCode != "" {
		t.Fatalf("accepted %+v", got)
	}
	if me := must(a.Me(ctx, zhou)); me.TeacherID != inv.ID {
		t.Fatalf("me %+v", me)
	}
	_, err = a.TeacherInvite(ctx, zhou, inv.InviteCode)
	wantCode(t, err, "NOT_FOUND")

	// 已经是讲师，不能再接受别的邀请
	other := must(a.CreateTeacher(ctx, owner, testTeacher))
	_, err = a.AcceptTeacherInvite(ctx, zhou, other.InviteCode, AcceptInviteReq{AgreementVersion: TeacherAgreementVersion})
	wantMsg(t, err, "你已经是讲师了")

	// 确认后比例不能改，可以改别的；不能删
	_, err = a.UpdateTeacher(ctx, owner, inv.ID, TeacherInput{Name: "小周", Avatar: "placeholder:g5", ShareRate: 30})
	wantCode(t, err, "INVALID_STATE")
	if v := must(a.UpdateTeacher(ctx, owner, inv.ID, TeacherInput{Name: "周小姐", Avatar: "placeholder:g5", ShareRate: 12})); v.Name != "周小姐" {
		t.Fatal(v)
	}
	wantCode(t, a.DeleteTeacher(ctx, owner, inv.ID), "INVALID_STATE")

	// 上架 TA 的课，然后 TA 自己结束合作：课全部下架
	upd := testCourse
	upd.ArtistID, upd.TeacherID = "", inv.ID
	must(a.UpdateCourse(ctx, owner, hidden.ID, upd))
	if _, err := a.Course(ctx, nil, hidden.ID); err != nil {
		t.Fatal(err)
	}
	if v := must(a.QuitTeaching(ctx, zhou)); v.Status != TeacherEnded {
		t.Fatal(v)
	}
	_, err = a.Course(ctx, nil, hidden.ID)
	wantCode(t, err, "NOT_FOUND")
	if mine := must(a.MyTeaching(ctx, zhou)); len(mine.Courses) != 1 || !mine.Courses[0].Hidden {
		t.Fatalf("my courses %+v", mine.Courses)
	}
	_, err = a.UpdateCourse(ctx, owner, hidden.ID, upd)
	wantMsg(t, err, "和 TA 的合作已经结束了，这门课不能上架")
	_, err = a.QuitTeaching(ctx, zhou)
	wantCode(t, err, "INVALID_STATE")

	// 收回还没确认的邀请；没确认、没课的可以删
	must(a.EndTeacher(ctx, owner, other.ID))
	_, err = a.TeacherInvite(ctx, zhou, other.InviteCode)
	wantCode(t, err, "NOT_FOUND")
	if err := a.DeleteTeacher(ctx, owner, other.ID); err != nil {
		t.Fatal(err)
	}
	_, err = a.Teachers(ctx, zhou)
	wantCode(t, err, "FORBIDDEN")
}

func TestCourseOwnerEdits(t *testing.T) {
	r := newClassroom(t)
	ctx := context.Background()

	r.c.advance(time.Second)
	c := must(r.a.CreateCourse(ctx, r.owner, testCourse))
	if c.Title != "新娘早妆" || c.LessonCount != 1 || c.Products[0].Tip != "" || c.Chapters[0].Lessons[0].ID == "" {
		t.Fatalf("created %+v", c)
	}
	if must(r.a.OwnerCourses(ctx, r.owner))[0].ID != c.ID {
		t.Fatal("new course first")
	}

	// 修改时保留原来小节的 id，别的课的小节 id 不认
	in := r.c1Input()
	in.Chapters[1].Lessons = append(in.Chapters[1].Lessons, Lesson{Title: "补妆", Video: "placeholder:v2", DurationSec: 60})
	upd := must(r.a.UpdateCourse(ctx, r.owner, r.c1.ID, in))
	if upd.Chapters[0].Lessons[0].ID != r.c1.Chapters[0].Lessons[0].ID || upd.Chapters[1].Lessons[2].ID == "" {
		t.Fatalf("ids %+v", upd.Chapters)
	}
	in = r.c1Input()
	in.Chapters[0].Lessons[0].ID = r.c3.Chapters[0].Lessons[0].ID
	_, err := r.a.UpdateCourse(ctx, r.owner, r.c1.ID, in)
	wantMsg(t, err, "有小节不是这门课的，刷新后再改")

	bad := testCourse
	bad.ArtistID = "nope"
	_, err = r.a.CreateCourse(ctx, r.owner, bad)
	wantMsg(t, err, "选的化妆师不在了，换一位吧")
	bad = testCourse
	bad.ServiceID = "nope"
	_, err = r.a.CreateCourse(ctx, r.owner, bad)
	wantMsg(t, err, "关联的项目不在了，换一个吧")

	// 化妆师名下有课时不能删（先把作品挪走）
	for _, w := range must(r.a.OwnerWorks(ctx, r.owner)) {
		if w.ArtistID == "a2" {
			if err := r.a.DeleteWork(ctx, r.owner, w.ID); err != nil {
				t.Fatal(err)
			}
		}
	}
	wantMsg(t, r.a.DeleteArtist(ctx, r.owner, "a2"), "TA 名下还有 1 门课，先改给别人或删掉")

	// 删掉项目后课程不再带 serviceId
	if err := r.a.DeleteService(ctx, r.owner, "s3"); err != nil {
		t.Fatal(err)
	}
	if must(r.a.OwnerCourse(ctx, r.owner, c.ID)).ServiceID != "" {
		t.Fatal("serviceId should be cleared")
	}

	// 删课后客人看不到
	if err := r.a.DeleteCourse(ctx, r.owner, c.ID); err != nil {
		t.Fatal(err)
	}
	_, err = r.a.Course(ctx, nil, c.ID)
	wantCode(t, err, "NOT_FOUND")
	_, err = r.a.CreateCourse(ctx, user(t, r.a, "o-alice"), testCourse)
	wantCode(t, err, "FORBIDDEN")
}

func TestCoursesHTTP(t *testing.T) {
	r := newClassroom(t)
	h := r.a.Routes()

	// 公开：不带 openid 也能看列表和详情
	status, _, raw := do(t, h, "GET", "/v1/courses", "", "")
	if status != http.StatusOK || !strings.Contains(raw, "单眼皮的眼妆") {
		t.Fatalf("list %d %s", status, raw)
	}
	status, _, raw = do(t, h, "GET", "/v1/courses/"+r.c1.ID, "", "")
	if status != http.StatusOK || strings.Contains(raw, `"progress"`) {
		t.Fatalf("detail %d %s", status, raw)
	}

	lesson := r.c1.Chapters[0].Lessons[0].ID
	status, _, raw = do(t, h, "PUT", "/v1/courses/"+r.c1.ID+"/progress", "o-alice", `{"lessonId":"`+lesson+`","positionSec":30}`)
	if status != http.StatusOK || !strings.Contains(raw, `"positionSec":30`) {
		t.Fatalf("progress %d %s", status, raw)
	}
	status, _, raw = do(t, h, "GET", "/v1/courses/"+r.c1.ID, "o-alice", "")
	if status != http.StatusOK || !strings.Contains(raw, `"progress"`) {
		t.Fatalf("detail with progress %d %s", status, raw)
	}

	status, _, raw = do(t, h, "GET", "/v1/me/teaching", "o-lin", "")
	if status != http.StatusOK || strings.Contains(raw, "userId") {
		t.Fatalf("teaching %d %s", status, raw)
	}
	status, _, _ = do(t, h, "GET", "/v1/owner/teachers", "o-alice", "")
	if status != http.StatusForbidden {
		t.Fatalf("teachers for customer %d", status)
	}
	status, _, raw = do(t, h, "GET", "/v1/owner/teachers", ownerOpenID, "")
	if status != http.StatusOK || strings.Contains(raw, "userId") {
		t.Fatalf("teachers %d %s", status, raw)
	}
	status, body, _ := do(t, h, "POST", "/v1/owner/payouts/"+r.teacher.ID+"/2026-10/paid", ownerOpenID, "")
	if status != http.StatusConflict || body["code"] != "INVALID_STATE" {
		t.Fatalf("mark paid %d %v", status, body)
	}
	status, _, _ = do(t, h, "GET", "/v1/teacher-invites/NOPE1234", "o-alice", "")
	if status != http.StatusNotFound {
		t.Fatalf("invite %d", status)
	}
}

func TestSeedCourses(t *testing.T) {
	a, _ := newTestApp(t)
	ctx := context.Background()
	c, err := a.catalog(ctx)
	if err != nil {
		t.Fatal(err)
	}
	// 初始课程要能通过店主保存时的同一套检查
	for i := range c.Courses {
		r := &c.Courses[i]
		if _, err := a.checkCourse(c, r.CourseInput, r); err != nil {
			t.Fatalf("seed %s: %v", r.ID, err)
		}
	}
	list := must(a.Courses(ctx, ""))
	if len(list) != 2 || list[0].ID != "c2" || list[1].ID != "c1" || list[1].Teacher.Name != "七七" {
		t.Fatalf("seed courses %+v", list)
	}
}
