-- 课堂。课程和顾客讲师是店主维护的资料，存在 catalog 表（kind = course / teacher）。
-- 预约记下从哪门课来；讲师是顾客讲师、而且能分成时记下讲师和下单时的分成比例（到店完成后才算数）。
ALTER TABLE bookings
  ADD COLUMN course_id    VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN course_title VARCHAR(64) NOT NULL DEFAULT '',
  ADD COLUMN teacher_id   VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN share_rate   INT         NOT NULL DEFAULT 0,
  ADD KEY idx_teacher_date (teacher_id, date);

-- 客人在每门课上看到哪了。finished 是看完的小节 id 数组
CREATE TABLE course_progress (
  user_id      VARCHAR(32) NOT NULL,
  course_id    VARCHAR(32) NOT NULL,
  lesson_id    VARCHAR(32) NOT NULL,
  position_sec INT         NOT NULL,
  finished     JSON        NOT NULL,
  updated_at   DATETIME    NOT NULL,
  PRIMARY KEY (user_id, course_id),
  KEY idx_course (course_id)
) DEFAULT CHARSET=utf8mb4;

-- 店主标记已付的分成：一位讲师一个月一行，data 是标记时的 Payout（金额和明细定格）
CREATE TABLE teacher_payouts (
  teacher_id VARCHAR(32) NOT NULL,
  month      CHAR(7)     NOT NULL,
  data       JSON        NOT NULL,
  paid_at    DATETIME    NOT NULL,
  PRIMARY KEY (teacher_id, month)
) DEFAULT CHARSET=utf8mb4;
