package main

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math"
	"regexp"
	"strings"
	"time"
)

// 课堂：课程、观看进度、顾客讲师的授权和分成。规则和 src/api/mock.ts 一致，用例见 courses_test.go（和 mock.course.test.ts 对齐）。
// 课程和讲师是店主维护的资料，存在 catalog 表（kind = course / teacher）；讲师记着 TA 的用户 id，不返回给前端。
// 分成：客人从顾客讲师的课点“预约同款”下的单，下单时记下讲师和比例（bookings.teacher_id / share_rate），
// 到店完成后按项目标价 × 比例算一笔，按到店月份汇总；店主月底后标记已付，金额和明细定格在 teacher_payouts。

const (
	kindCourse  = "course"
	kindTeacher = "teacher"
)

// ---------- 字段规则（对应 src/api/catalog.ts） ----------

const (
	limCourseTitle    = 20
	limCourseSummary  = 60
	limChapters       = 20
	limChapterTitle   = 20
	limLessons        = 30 // 每章
	limLessonTitle    = 30
	limMaxLessonSec   = 3600
	limCourseProducts = 30
	limProductTip     = 40
	limMaxCourses     = 100
	limTeacherName    = 10
	limTeacherIntro   = 30
	limMaxShareRate   = 50
)

// teacherRec 存储里的讲师：比返回的多一个 TA 的用户 id
type teacherRec struct {
	Teacher
	UserID string `json:"userId,omitempty"`
}

// courseRec 存储里的课程：就是提交的内容，小节都带上了 id
type courseRec struct {
	ID string `json:"-"`
	CourseInput
}

func uniq(list []string) []string {
	out := []string{}
	seen := map[string]bool{}
	for _, v := range list {
		if v != "" && !seen[v] {
			seen[v] = true
			out = append(out, v)
		}
	}
	return out
}

func cleanCourse(c CourseInput) CourseInput {
	out := CourseInput{
		Title: strings.TrimSpace(c.Title), Summary: strings.TrimSpace(c.Summary), Category: c.Category,
		Cover: strings.TrimSpace(c.Cover), ArtistID: c.ArtistID, TeacherID: c.TeacherID, ServiceID: c.ServiceID,
		Chapters: []Chapter{}, Products: []CourseProductRef{}, Hidden: c.Hidden,
	}
	for _, ch := range c.Chapters {
		lessons := []Lesson{}
		for _, l := range ch.Lessons {
			lessons = append(lessons, Lesson{
				ID: l.ID, Title: strings.TrimSpace(l.Title), Video: strings.TrimSpace(l.Video),
				DurationSec: l.DurationSec, ProductIDs: uniq(l.ProductIDs),
			})
		}
		out.Chapters = append(out.Chapters, Chapter{Title: strings.TrimSpace(ch.Title), Lessons: lessons})
	}
	// 同一件化妆品只留第一次出现的
	seen := map[string]bool{}
	for _, p := range c.Products {
		if p.ProductID == "" || seen[p.ProductID] {
			continue
		}
		seen[p.ProductID] = true
		out.Products = append(out.Products, CourseProductRef{ProductID: p.ProductID, Tip: strings.TrimSpace(p.Tip)})
	}
	return out
}

func validateCourse(c CourseInput) string {
	var rules []string
	add := func(bad bool, msg string) {
		if bad {
			rules = append(rules, msg)
		}
	}
	rules = append(rules,
		textRule(c.Title, "课程名", limCourseTitle),
		textRule(c.Summary, "一句话介绍", limCourseSummary))
	add(!categories[c.Category], "还没选风格")
	rules = append(rules, imageRule(c.Cover, "封面"))
	add(c.ArtistID == "" && c.TeacherID == "", "还没选讲师")
	add(c.ArtistID != "" && c.TeacherID != "", "讲师只能选一位")
	add(len(c.Chapters) == 0, "至少要有一章")
	add(len(c.Chapters) > limChapters, fmt.Sprintf("最多 %d 章", limChapters))
	for _, ch := range c.Chapters {
		rules = append(rules, textRule(ch.Title, "章节名", limChapterTitle))
		add(len(ch.Lessons) == 0, fmt.Sprintf("「%s」还没有小节", ch.Title))
		add(len(ch.Lessons) > limLessons, fmt.Sprintf("每章最多 %d 节", limLessons))
	}
	products := map[string]bool{}
	for _, p := range c.Products {
		products[p.ProductID] = true
	}
	for _, ch := range c.Chapters {
		for _, l := range ch.Lessons {
			rules = append(rules, textRule(l.Title, "小节名", limLessonTitle))
			add(l.Video == "", fmt.Sprintf("「%s」还没传视频", l.Title))
			add(len(l.Video) > limImageRef, fmt.Sprintf("「%s」的视频地址太长了", l.Title))
			add(l.DurationSec < 1 || l.DurationSec > limMaxLessonSec, fmt.Sprintf("「%s」的视频要在 %d 分钟以内", l.Title, limMaxLessonSec/60))
			for _, id := range l.ProductIDs {
				if !products[id] {
					add(true, fmt.Sprintf("「%s」用到的化妆品要先加进本课清单", l.Title))
					break
				}
			}
		}
	}
	add(len(c.Products) > limCourseProducts, fmt.Sprintf("本课清单最多 %d 件", limCourseProducts))
	for _, p := range c.Products {
		if runes(p.Tip) > limProductTip {
			add(true, fmt.Sprintf("化妆品用法每条最多 %d 个字", limProductTip))
			break
		}
	}
	return firstRule(rules...)
}

func cleanTeacher(t TeacherInput) TeacherInput {
	return TeacherInput{
		Name: strings.TrimSpace(t.Name), Avatar: strings.TrimSpace(t.Avatar), Intro: strings.TrimSpace(t.Intro), ShareRate: t.ShareRate,
	}
}

func validateTeacher(t TeacherInput) string {
	rate := ""
	if t.ShareRate < 0 || t.ShareRate > limMaxShareRate {
		rate = fmt.Sprintf("分成比例填 0–%d 的整数", limMaxShareRate)
	}
	return firstRule(
		textRule(t.Name, "名字", limTeacherName),
		optTextRule(t.Intro, "介绍", limTeacherIntro),
		imageRule(t.Avatar, "头像"),
		rate,
	)
}

// ---------- 读取 ----------

func (c *Catalog) course(id string) *courseRec {
	for i := range c.Courses {
		if c.Courses[i].ID == id {
			return &c.Courses[i]
		}
	}
	return nil
}

func (c *Catalog) teacher(id string) *teacherRec {
	for i := range c.Teachers {
		if c.Teachers[i].ID == id {
			return &c.Teachers[i]
		}
	}
	return nil
}

func (c *Catalog) product(id string) *Product {
	for i := range c.Products {
		if c.Products[i].ID == id {
			return &c.Products[i]
		}
	}
	return nil
}

// myTeacher 这位客人接受过的讲师邀请：合作中的优先，否则取最近确认的
func (c *Catalog) myTeacher(userID string) *teacherRec {
	var best *teacherRec
	for i := range c.Teachers {
		t := &c.Teachers[i]
		if t.UserID != userID {
			continue
		}
		if t.Status == TeacherActive {
			return t
		}
		if best == nil || t.AgreedAt > best.AgreedAt {
			best = t
		}
	}
	return best
}

func lessonsOf(r *courseRec) []Lesson {
	var out []Lesson
	for _, ch := range r.Chapters {
		out = append(out, ch.Lessons...)
	}
	return out
}

func (c *Catalog) courseTeacher(r *courseRec) CourseTeacher {
	if a := c.artist(r.ArtistID); a != nil {
		var parts []string
		if a.Title != "" {
			parts = append(parts, a.Title)
		} else if a.Specialty != "" {
			parts = append(parts, a.Specialty)
		}
		parts = append(parts, fmt.Sprintf("%d 年", a.Years))
		return CourseTeacher{Kind: "artist", Name: a.Name, Avatar: a.Avatar, Intro: strings.Join(parts, " · ")}
	}
	if t := c.teacher(r.TeacherID); t != nil {
		return CourseTeacher{Kind: "customer", Name: t.Name, Avatar: t.Avatar, Intro: t.Intro}
	}
	return CourseTeacher{Kind: "artist", Avatar: "placeholder:blank"}
}

func (c *Catalog) courseSummary(r *courseRec) CourseSummary {
	s := CourseSummary{
		ID: r.ID, Title: r.Title, Summary: r.Summary, Category: r.Category, Cover: r.Cover,
		Teacher: c.courseTeacher(r), ArtistID: r.ArtistID, TeacherID: r.TeacherID, Hidden: r.Hidden,
	}
	for _, l := range lessonsOf(r) {
		s.LessonCount++
		s.DurationSec += l.DurationSec
	}
	return s
}

func (c *Catalog) courseDetail(r *courseRec, forOwner bool) Course {
	d := Course{CourseSummary: c.courseSummary(r), Chapters: r.Chapters, Products: []CourseProduct{}}
	for _, p := range r.Products {
		if v := c.product(p.ProductID); v != nil {
			d.Products = append(d.Products, CourseProduct{Product: *v, Tip: p.Tip})
		}
	}
	// 和作品一样：项目下架了客人那边就不预选
	if s := c.service(r.ServiceID); s != nil && (forOwner || !s.Hidden) {
		d.ServiceID = s.ID
	}
	return d
}

func (c *Catalog) visibleCourse(id string) (*courseRec, error) {
	r := c.course(id)
	if r == nil || r.Hidden {
		return nil, apiErr("NOT_FOUND", "这门课已经下架了")
	}
	return r, nil
}

// Courses GET /courses  不含已下架的，新的在前
func (a *App) Courses(ctx context.Context, category string) ([]CourseSummary, error) {
	c, err := a.catalog(ctx)
	if err != nil {
		return nil, err
	}
	out := []CourseSummary{}
	for i := range c.Courses {
		r := &c.Courses[i]
		if !r.Hidden && (category == "" || r.Category == category) {
			out = append(out, c.courseSummary(r))
		}
	}
	return out, nil
}

// Course GET /courses/:id  公开资料；u 不为空（带了登录态）时附上进度
func (a *App) Course(ctx context.Context, u *User, id string) (Course, error) {
	c, err := a.catalog(ctx)
	if err != nil {
		return Course{}, err
	}
	r, err := c.visibleCourse(id)
	if err != nil {
		return Course{}, err
	}
	d := c.courseDetail(r, false)
	if u != nil {
		p, err := a.store.CourseProgress(ctx, u.ID, id)
		if err != nil {
			return Course{}, err
		}
		if p != nil {
			d.Progress = progressView(p)
		}
	}
	return d, nil
}

func progressView(p *ProgressRow) *CourseProgress {
	finished := p.Finished
	if finished == nil {
		finished = []string{}
	}
	return &CourseProgress{LessonID: p.LessonID, PositionSec: p.PositionSec, FinishedLessonIDs: finished, UpdatedAt: ts(p.UpdatedAt)}
}

// SaveCourseProgress PUT /courses/:id/progress  超过时长按时长算，离结尾不到 5 秒算看完这一节
func (a *App) SaveCourseProgress(ctx context.Context, u *User, courseID string, req SaveProgressReq) (CourseProgress, error) {
	c, err := a.catalog(ctx)
	if err != nil {
		return CourseProgress{}, err
	}
	r, err := c.visibleCourse(courseID)
	if err != nil {
		return CourseProgress{}, err
	}
	var lesson *Lesson
	for _, l := range lessonsOf(r) {
		if l.ID == req.LessonID {
			lesson = &l
			break
		}
	}
	if lesson == nil {
		return CourseProgress{}, apiErr("NOT_FOUND", "这一节已经不在了")
	}
	pos := 0
	if !math.IsNaN(req.PositionSec) && req.PositionSec > 0 {
		pos = int(math.Min(math.Floor(req.PositionSec), float64(lesson.DurationSec)))
	}
	old, err := a.store.CourseProgress(ctx, u.ID, courseID)
	if err != nil {
		return CourseProgress{}, err
	}
	finished := []string{}
	if old != nil {
		finished = append(finished, old.Finished...)
	}
	if pos >= lesson.DurationSec-5 && !contains(finished, lesson.ID) {
		finished = append(finished, lesson.ID)
	}
	p := ProgressRow{LessonID: lesson.ID, PositionSec: pos, Finished: finished, UpdatedAt: a.now().UTC()}
	if err := a.store.SaveCourseProgress(ctx, u.ID, courseID, p); err != nil {
		return CourseProgress{}, err
	}
	return *progressView(&p), nil
}

// attribute 下单时记下是从哪门课来的；讲师是合作中的顾客讲师、又不是自己时，记下讲师和这时的分成比例
func attribute(c *Catalog, u *User, b *BookingRow, courseID string) {
	r := c.course(courseID)
	if r == nil || r.Hidden {
		return
	}
	b.CourseID, b.CourseTitle = r.ID, r.Title
	if t := c.teacher(r.TeacherID); t != nil && t.Status == TeacherActive && t.UserID != u.ID {
		b.TeacherID, b.ShareRate = t.ID, t.ShareRate
	}
}

// ---------- 顾客讲师（客人这边） ----------

func (c *Catalog) invite(code string) *teacherRec {
	if code == "" {
		return nil
	}
	for i := range c.Teachers {
		if t := &c.Teachers[i]; t.Status == TeacherInvited && t.InviteCode == code {
			return t
		}
	}
	return nil
}

var errInviteGone = apiErr("NOT_FOUND", "这个邀请已经失效了，找店里重新要一个")

// TeacherInvite GET /teacher-invites/:code
func (a *App) TeacherInvite(ctx context.Context, _ *User, code string) (TeacherInvite, error) {
	c, err := a.catalog(ctx)
	if err != nil {
		return TeacherInvite{}, err
	}
	t := c.invite(code)
	if t == nil {
		return TeacherInvite{}, errInviteGone
	}
	return TeacherInvite{Code: code, Name: t.Name, ShareRate: t.ShareRate, ShopName: c.Shop.Name, AgreementVersion: TeacherAgreementVersion}, nil
}

// AcceptTeacherInvite POST /teacher-invites/:code/accept
func (a *App) AcceptTeacherInvite(ctx context.Context, u *User, code string, req AcceptInviteReq) (Teacher, error) {
	c, err := a.catalog(ctx)
	if err != nil {
		return Teacher{}, err
	}
	t := c.invite(code)
	if t == nil {
		return Teacher{}, errInviteGone
	}
	if req.AgreementVersion != TeacherAgreementVersion {
		return Teacher{}, apiErr("INVALID_STATE", "授权说明更新了，重新看一遍再确认")
	}
	if mine := c.myTeacher(u.ID); mine != nil && mine.Status == TeacherActive {
		return Teacher{}, apiErr("INVALID_STATE", "你已经是讲师了")
	}
	t.Status, t.UserID, t.AgreedAt, t.AgreementVersion, t.InviteCode = TeacherActive, u.ID, ts(a.now()), req.AgreementVersion, ""
	if err := a.put(ctx, kindTeacher, t.ID, t); err != nil {
		return Teacher{}, err
	}
	return t.Teacher, nil
}

// MyTeaching GET /me/teaching
func (a *App) MyTeaching(ctx context.Context, u *User) (MyTeaching, error) {
	c, err := a.catalog(ctx)
	if err != nil {
		return MyTeaching{}, err
	}
	t := c.myTeacher(u.ID)
	if t == nil {
		return MyTeaching{}, apiErr("NOT_FOUND", "你还不是讲师")
	}
	out := MyTeaching{Teacher: t.Teacher, Courses: []CourseSummary{}}
	out.Teacher.InviteCode = ""
	for i := range c.Courses {
		if c.Courses[i].TeacherID == t.ID {
			out.Courses = append(out.Courses, c.courseSummary(&c.Courses[i]))
		}
	}
	out.Payouts, err = a.payouts(ctx, c, t.ID)
	return out, err
}

// QuitTeaching POST /me/teaching/quit
func (a *App) QuitTeaching(ctx context.Context, u *User) (Teacher, error) {
	c, err := a.catalog(ctx)
	if err != nil {
		return Teacher{}, err
	}
	t := c.myTeacher(u.ID)
	if t == nil || t.Status != TeacherActive {
		return Teacher{}, apiErr("INVALID_STATE", "你现在不是合作中的讲师")
	}
	if err := a.endTeaching(ctx, c, t); err != nil {
		return Teacher{}, err
	}
	return t.Teacher, nil
}

// endTeaching 结束合作：邀请作废，TA 的课全部下架
func (a *App) endTeaching(ctx context.Context, c *Catalog, t *teacherRec) error {
	t.Status, t.EndedAt, t.InviteCode = TeacherEnded, ts(a.now()), ""
	if err := a.put(ctx, kindTeacher, t.ID, t); err != nil {
		return err
	}
	for i := range c.Courses {
		r := &c.Courses[i]
		if r.TeacherID == t.ID && !r.Hidden {
			r.Hidden = true
			if err := a.put(ctx, kindCourse, r.ID, r.CourseInput); err != nil {
				return err
			}
		}
	}
	return nil
}

// ---------- 店主管课程 ----------

func (a *App) OwnerCourses(ctx context.Context, u *User) ([]CourseSummary, error) {
	c, err := a.ownerCatalog(ctx, u)
	if err != nil {
		return nil, err
	}
	out := []CourseSummary{}
	for i := range c.Courses {
		out = append(out, c.courseSummary(&c.Courses[i]))
	}
	return out, nil
}

func (a *App) OwnerCourse(ctx context.Context, u *User, id string) (Course, error) {
	c, err := a.ownerCatalog(ctx, u)
	if err != nil {
		return Course{}, err
	}
	r := c.course(id)
	if r == nil {
		return Course{}, errNotFound
	}
	return c.courseDetail(r, true), nil
}

// checkCourse 检查字段和引用，给新小节分配 id。old 是修改前的课
func (a *App) checkCourse(c *Catalog, req CourseInput, old *courseRec) (CourseInput, error) {
	v := cleanCourse(req)
	if msg := validateCourse(v); msg != "" {
		return v, badRequest(msg)
	}
	if v.ArtistID != "" && c.artist(v.ArtistID) == nil {
		return v, badRequest("选的化妆师不在了，换一位吧")
	}
	var t *teacherRec
	if v.TeacherID != "" {
		if t = c.teacher(v.TeacherID); t == nil {
			return v, badRequest("选的讲师不在了，换一位吧")
		}
	}
	if t != nil && t.Status != TeacherActive && !v.Hidden {
		if t.Status == TeacherInvited {
			return v, badRequest("TA 还没确认授权，先存成下架，确认后再上架")
		}
		return v, badRequest("和 TA 的合作已经结束了，这门课不能上架")
	}
	if v.ServiceID != "" && c.service(v.ServiceID) == nil {
		return v, badRequest("关联的项目不在了，换一个吧")
	}
	for _, p := range v.Products {
		if c.product(p.ProductID) == nil {
			return v, badRequest("有化妆品已经从店里的清单删掉了，重新选一下")
		}
	}
	oldIDs := map[string]bool{}
	if old != nil {
		for _, l := range lessonsOf(old) {
			oldIDs[l.ID] = true
		}
	}
	used := map[string]bool{}
	for ci := range v.Chapters {
		for li := range v.Chapters[ci].Lessons {
			l := &v.Chapters[ci].Lessons[li]
			if l.ID != "" && (!oldIDs[l.ID] || used[l.ID]) {
				return v, badRequest("有小节不是这门课的，刷新后再改")
			}
			if l.ID == "" {
				l.ID = newID("l")
			}
			used[l.ID] = true
		}
	}
	return v, nil
}

func (a *App) CreateCourse(ctx context.Context, u *User, req CourseInput) (Course, error) {
	c, err := a.ownerCatalog(ctx, u)
	if err != nil {
		return Course{}, err
	}
	if len(c.Courses) >= limMaxCourses {
		return Course{}, badRequest(fmt.Sprintf("课程最多放 %d 门", limMaxCourses))
	}
	v, err := a.checkCourse(c, req, nil)
	if err != nil {
		return Course{}, err
	}
	r := courseRec{ID: newID("c"), CourseInput: v}
	if err := a.put(ctx, kindCourse, r.ID, r.CourseInput); err != nil {
		return Course{}, err
	}
	return c.courseDetail(&r, true), nil
}

func (a *App) UpdateCourse(ctx context.Context, u *User, id string, req CourseInput) (Course, error) {
	c, err := a.ownerCatalog(ctx, u)
	if err != nil {
		return Course{}, err
	}
	old := c.course(id)
	if old == nil {
		return Course{}, errNotFound
	}
	v, err := a.checkCourse(c, req, old)
	if err != nil {
		return Course{}, err
	}
	r := courseRec{ID: id, CourseInput: v}
	if err := a.put(ctx, kindCourse, id, r.CourseInput); err != nil {
		return Course{}, err
	}
	// 删掉的小节不再算进度
	keep := map[string]bool{}
	for _, l := range lessonsOf(&r) {
		keep[l.ID] = true
	}
	if err := a.store.TrimCourseProgress(ctx, id, keep); err != nil {
		return Course{}, err
	}
	return c.courseDetail(&r, true), nil
}

// DeleteCourse 观看记录一起删；已经记下的分成在预约上，不受影响
func (a *App) DeleteCourse(ctx context.Context, u *User, id string) error {
	if _, err := a.ownerCatalog(ctx, u); err != nil {
		return err
	}
	if err := a.remove(ctx, kindCourse, id); err != nil {
		return err
	}
	return a.store.TrimCourseProgress(ctx, id, nil)
}

// ---------- 店主管讲师 ----------

func (a *App) Teachers(ctx context.Context, u *User) ([]Teacher, error) {
	c, err := a.ownerCatalog(ctx, u)
	if err != nil {
		return nil, err
	}
	out := []Teacher{}
	for _, t := range c.Teachers {
		out = append(out, t.Teacher)
	}
	return out, nil
}

const inviteAlphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

// newInviteCode 8 位大写字母和数字，不和现有的邀请重复
func newInviteCode(c *Catalog) string {
	for {
		b := make([]byte, 8)
		_, _ = rand.Read(b)
		for i := range b {
			b[i] = inviteAlphabet[int(b[i])%len(inviteAlphabet)]
		}
		if c.invite(string(b)) == nil {
			return string(b)
		}
	}
}

func (a *App) CreateTeacher(ctx context.Context, u *User, req TeacherInput) (Teacher, error) {
	c, err := a.ownerCatalog(ctx, u)
	if err != nil {
		return Teacher{}, err
	}
	v := cleanTeacher(req)
	if msg := validateTeacher(v); msg != "" {
		return Teacher{}, badRequest(msg)
	}
	t := teacherRec{Teacher: Teacher{
		ID: newID("t"), Name: v.Name, Avatar: v.Avatar, Intro: v.Intro, ShareRate: v.ShareRate,
		Status: TeacherInvited, InviteCode: newInviteCode(c),
	}}
	return t.Teacher, a.put(ctx, kindTeacher, t.ID, t)
}

func (a *App) UpdateTeacher(ctx context.Context, u *User, id string, req TeacherInput) (Teacher, error) {
	c, err := a.ownerCatalog(ctx, u)
	if err != nil {
		return Teacher{}, err
	}
	t := c.teacher(id)
	if t == nil {
		return Teacher{}, errNotFound
	}
	v := cleanTeacher(req)
	if msg := validateTeacher(v); msg != "" {
		return Teacher{}, badRequest(msg)
	}
	if t.Status != TeacherInvited && v.ShareRate != t.ShareRate {
		return Teacher{}, apiErr("INVALID_STATE", "分成比例 TA 已经确认过了，不能改；要改就结束合作再重新邀请")
	}
	t.Name, t.Avatar, t.Intro, t.ShareRate = v.Name, v.Avatar, v.Intro, v.ShareRate
	return t.Teacher, a.put(ctx, kindTeacher, id, t)
}

func (a *App) EndTeacher(ctx context.Context, u *User, id string) (Teacher, error) {
	c, err := a.ownerCatalog(ctx, u)
	if err != nil {
		return Teacher{}, err
	}
	t := c.teacher(id)
	if t == nil {
		return Teacher{}, errNotFound
	}
	if t.Status == TeacherEnded {
		return Teacher{}, apiErr("INVALID_STATE", "已经结束合作了")
	}
	if err := a.endTeaching(ctx, c, t); err != nil {
		return Teacher{}, err
	}
	return t.Teacher, nil
}

// DeleteTeacher 只能删还没确认、也没有课的
func (a *App) DeleteTeacher(ctx context.Context, u *User, id string) error {
	c, err := a.ownerCatalog(ctx, u)
	if err != nil {
		return err
	}
	t := c.teacher(id)
	if t == nil {
		return errNotFound
	}
	if t.AgreedAt != "" {
		return apiErr("INVALID_STATE", "TA 确认过授权，不能删，可以结束合作")
	}
	n := 0
	for _, r := range c.Courses {
		if r.TeacherID == id {
			n++
		}
	}
	if n > 0 {
		return apiErr("INVALID_STATE", fmt.Sprintf("TA 名下还有 %d 门课，先改给别人或删掉", n))
	}
	return a.remove(ctx, kindTeacher, id)
}

// ---------- 分成 ----------

var monthPattern = regexp.MustCompile(`^\d{4}-(0[1-9]|1[0-2])$`)

// payoutMonths 最近 6 个月（含本月），本月在前
func (a *App) payoutMonths() []string {
	now := a.now().In(shanghai)
	first := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, shanghai)
	out := make([]string, statsMonths)
	for i := range out {
		out[i] = first.AddDate(0, -i, 0).Format("2006-01")
	}
	return out
}

// nextMonth 'YYYY-MM' 的下个月 1 号
func nextMonth(month string) string {
	d, _ := time.ParseInLocation("2006-01", month, shanghai)
	return d.AddDate(0, 1, 0).Format("2006-01-02")
}

func shareRecord(b *BookingRow) ShareRecord {
	return ShareRecord{
		BookingID: b.ID, Date: b.Date, ServiceName: b.ServiceName, CourseTitle: b.CourseTitle,
		Price: b.Price, Rate: b.ShareRate, Amount: b.Price * b.ShareRate / 100,
	}
}

// buildPayout 一位讲师一个月的分成；没有分成返回 nil
func (a *App) buildPayout(t *teacherRec, month string, rows []*BookingRow) *Payout {
	p := Payout{TeacherID: t.ID, TeacherName: t.Name, Month: month, Status: PayoutOpen, Records: []ShareRecord{}}
	if month < a.payoutMonths()[0] {
		p.Status = PayoutDue
	}
	for _, b := range rows {
		if b.TeacherID == t.ID && b.Date[:7] == month {
			r := shareRecord(b)
			p.Records = append(p.Records, r)
			p.Count++
			p.Amount += r.Amount
		}
	}
	if p.Count == 0 {
		return nil
	}
	return &p
}

func (a *App) paidPayouts(ctx context.Context) (map[string]Payout, error) {
	list, err := a.store.PaidPayouts(ctx)
	if err != nil {
		return nil, err
	}
	out := map[string]Payout{}
	for _, p := range list {
		out[p.TeacherID+"|"+p.Month] = p
	}
	return out, nil
}

// payouts 最近 6 个月有分成的，月份新的在前、同月按讲师先后；teacherID 不为空时只看这一位
func (a *App) payouts(ctx context.Context, c *Catalog, teacherID string) ([]Payout, error) {
	months := a.payoutMonths()
	rows, err := a.store.ShareBookings(ctx, months[len(months)-1]+"-01", nextMonth(months[0]))
	if err != nil {
		return nil, err
	}
	paid, err := a.paidPayouts(ctx)
	if err != nil {
		return nil, err
	}
	out := []Payout{}
	for _, month := range months {
		for i := range c.Teachers {
			t := &c.Teachers[i]
			if teacherID != "" && t.ID != teacherID {
				continue
			}
			if p, ok := paid[t.ID+"|"+month]; ok {
				p.TeacherName = t.Name
				out = append(out, p)
			} else if p := a.buildPayout(t, month, rows); p != nil {
				out = append(out, *p)
			}
		}
	}
	return out, nil
}

// Payouts GET /owner/payouts
func (a *App) Payouts(ctx context.Context, u *User) ([]Payout, error) {
	c, err := a.ownerCatalog(ctx, u)
	if err != nil {
		return nil, err
	}
	return a.payouts(ctx, c, "")
}

// MarkPayoutPaid POST /owner/payouts/:teacherId/:month/paid
func (a *App) MarkPayoutPaid(ctx context.Context, u *User, teacherID, month string) (Payout, error) {
	c, err := a.ownerCatalog(ctx, u)
	if err != nil {
		return Payout{}, err
	}
	t := c.teacher(teacherID)
	if t == nil {
		return Payout{}, errNotFound
	}
	if !monthPattern.MatchString(month) {
		return Payout{}, badRequest("月份格式不对")
	}
	paid, err := a.paidPayouts(ctx)
	if err != nil {
		return Payout{}, err
	}
	errPaid := apiErr("INVALID_STATE", "这个月已经标记过了")
	if _, ok := paid[teacherID+"|"+month]; ok {
		return Payout{}, errPaid
	}
	rows, err := a.store.ShareBookings(ctx, month+"-01", nextMonth(month))
	if err != nil {
		return Payout{}, err
	}
	p := a.buildPayout(t, month, rows)
	if p == nil {
		return Payout{}, apiErr("INVALID_STATE", "这个月没有要付的分成")
	}
	if p.Status == PayoutOpen {
		return Payout{}, apiErr("INVALID_STATE", "这个月还没过完，月底后再结")
	}
	now := a.now()
	p.Status, p.PaidAt = PayoutPaid, ts(now)
	if err := a.store.InsertPaidPayout(ctx, *p, now); err != nil {
		if errors.Is(err, ErrStale) {
			return Payout{}, errPaid
		}
		return Payout{}, err
	}
	return *p, nil
}
