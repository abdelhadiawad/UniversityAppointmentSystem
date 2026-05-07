const express = require('express');

const cors = require('cors');

const path = require('path');

const { sql, getPool } = require('./db');

const app = express();

app.use(cors());

app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

/* =========================

   Home

========================= */

app.get('/', (req, res) => {

  res.sendFile(path.join(__dirname, 'public', 'index.html'));

});

/* =========================

   Test Database

========================= */

app.get('/api/test-db', async (req, res) => {

  try {

    const pool = await getPool();

    const result = await pool.request().query(`

      SELECT DB_NAME() AS database_name, GETDATE() AS server_time

    `);

    res.json({

      success: true,

      data: result.recordset[0]

    });

  } catch (error) {

    res.status(500).json({

      success: false,

      message: error.message

    });

  }

});

/* =========================

   Student Login

========================= */

app.post('/api/login', async (req, res) => {

  try {

    const { student_number, national_id } = req.body;

    if (!student_number || !national_id) {

      return res.status(400).json({

        success: false,

        message: 'Student number and national ID are required'

      });

    }

    const pool = await getPool();

    const result = await pool.request()

      .input('student_number', sql.NVarChar(20), student_number)

      .input('national_id', sql.Char(14), national_id)

      .query(`

        SELECT 

          s.student_id,

          s.full_name,

          s.student_number,

          s.national_id,

          s.phone,

          s.email,

          s.academic_level,

          f.faculty_id,

          f.faculty_name_ar,

          d.department_id,

          d.department_name_ar

        FROM Student s

        JOIN Faculty f ON s.faculty_id = f.faculty_id

        JOIN Department d ON s.department_id = d.department_id

        WHERE s.student_number = @student_number

          AND s.national_id = @national_id

      `);

    if (result.recordset.length === 0) {

      return res.status(401).json({

        success: false,

        message: 'رقم الطالب أو الرقم القومي غير صحيح'

      });

    }

    res.json({

      success: true,

      message: 'تم تسجيل الدخول بنجاح',

      student: result.recordset[0]

    });

  } catch (error) {

    console.error('Login Error:', error);

    res.status(500).json({

      success: false,

      message: 'حدث خطأ أثناء تسجيل الدخول'

    });

  }

});

/* =========================

   Get Student Data

========================= */

app.get('/api/students/:studentId', async (req, res) => {

  try {

    const { studentId } = req.params;

    const pool = await getPool();

    const result = await pool.request()

      .input('student_id', sql.Int, Number(studentId))

      .query(`

        SELECT 

          s.student_id,

          s.full_name,

          s.student_number,

          s.national_id,

          s.phone,

          s.email,

          s.academic_level,

          f.faculty_id,

          f.faculty_name_ar,

          d.department_id,

          d.department_name_ar

        FROM Student s

        JOIN Faculty f ON s.faculty_id = f.faculty_id

        JOIN Department d ON s.department_id = d.department_id

        WHERE s.student_id = @student_id

      `);

    if (result.recordset.length === 0) {

      return res.status(404).json({

        success: false,

        message: 'الطالب غير موجود'

      });

    }

    res.json({

      success: true,

      student: result.recordset[0]

    });

  } catch (error) {

    console.error('Get Student Error:', error);

    res.status(500).json({

      success: false,

      message: 'حدث خطأ أثناء جلب بيانات الطالب'

    });

  }

});

/* =========================

   Get Professors For Student Department

========================= */

app.get('/api/students/:studentId/professors', async (req, res) => {

  try {

    const { studentId } = req.params;

    const pool = await getPool();

    const result = await pool.request()

      .input('student_id', sql.Int, Number(studentId))

      .query(`

        SELECT 

          p.professor_id,

          p.full_name,

          p.email,

          p.phone,

          d.department_name_ar

        FROM Professor p

        JOIN Department d ON p.department_id = d.department_id

        WHERE p.department_id = (

          SELECT department_id

          FROM Student

          WHERE student_id = @student_id

        )

      `);

    res.json({

      success: true,

      professors: result.recordset

    });

  } catch (error) {

    console.error('Get Professors Error:', error);

    res.status(500).json({

      success: false,

      message: 'حدث خطأ أثناء جلب الدكاترة'

    });

  }

});

/* =========================

   Get Available Slots

========================= */

app.get('/api/students/:studentId/available-slots', async (req, res) => {

  try {

    const { studentId } = req.params;

    const pool = await getPool();

    const result = await pool.request()

      .input('student_id', sql.Int, Number(studentId))

      .query(`

        SELECT 

          ts.slot_id,

          ts.slot_date,

          ts.start_time,

          ts.end_time,

          p.professor_id,

          p.full_name AS professor_name,

          d.department_name_ar,

          at.type_name,

          at.duration_minutes,

          at.capacity,

          c.course_name,

          COUNT(b.booking_id) AS current_bookings,

          at.capacity - COUNT(b.booking_id) AS available_places

        FROM TimeSlot ts

        JOIN Professor p ON ts.professor_id = p.professor_id

        JOIN Department d ON p.department_id = d.department_id

        JOIN AppointmentType at ON ts.type_id = at.type_id

        LEFT JOIN Course c ON ts.course_id = c.course_id

        LEFT JOIN Booking b 

          ON ts.slot_id = b.slot_id

         AND b.status = 'booked'

        WHERE ts.is_active = 1

          AND at.duration_minutes >= 30

          AND p.department_id = (

            SELECT department_id

            FROM Student

            WHERE student_id = @student_id

          )

          AND (

            c.academic_level IS NULL

            OR c.academic_level = (

              SELECT academic_level

              FROM Student

              WHERE student_id = @student_id

            )

          )

        GROUP BY 

          ts.slot_id,

          ts.slot_date,

          ts.start_time,

          ts.end_time,

          p.professor_id,

          p.full_name,

          d.department_name_ar,

          at.type_name,

          at.duration_minutes,

          at.capacity,

          c.course_name,

          c.academic_level

        HAVING COUNT(b.booking_id) < at.capacity

        ORDER BY ts.slot_date, ts.start_time

      `);

    res.json({

      success: true,

      slots: result.recordset

    });

  } catch (error) {

    console.error('Available Slots Error:', error);

    res.status(500).json({

      success: false,

      message: 'حدث خطأ أثناء جلب المواعيد المتاحة'

    });

  }

});

/* =========================

   Book Appointment

========================= */

app.post('/api/bookings', async (req, res) => {

  let transaction;

  try {

    const { student_id, slot_id } = req.body;

    if (!student_id || !slot_id) {

      return res.status(400).json({

        success: false,

        message: 'student_id و slot_id مطلوبين'

      });

    }

    const pool = await getPool();

    transaction = new sql.Transaction(pool);

    await transaction.begin();

    const checkRequest = new sql.Request(transaction);

    checkRequest.input('student_id', sql.Int, Number(student_id));

    checkRequest.input('slot_id', sql.Int, Number(slot_id));

    const checkResult = await checkRequest.query(`

      DECLARE @studentDepartmentId INT;

      DECLARE @slotDepartmentId INT;

      DECLARE @studentLevel NVARCHAR(50);

      DECLARE @courseLevel NVARCHAR(50);

      DECLARE @capacity INT;

      DECLARE @currentBookings INT;

      SELECT 

        @studentDepartmentId = department_id,

        @studentLevel = academic_level

      FROM Student

      WHERE student_id = @student_id;

      SELECT 

        @slotDepartmentId = p.department_id,

        @capacity = at.capacity,

        @courseLevel = c.academic_level

      FROM TimeSlot ts

      JOIN Professor p ON ts.professor_id = p.professor_id

      JOIN AppointmentType at ON ts.type_id = at.type_id

      LEFT JOIN Course c ON ts.course_id = c.course_id

      WHERE ts.slot_id = @slot_id

        AND ts.is_active = 1

        AND at.duration_minutes >= 30;

      SELECT 

        @currentBookings = COUNT(*)

      FROM Booking

      WHERE slot_id = @slot_id

        AND status = 'booked';

      SELECT 

        @studentDepartmentId AS studentDepartmentId,

        @slotDepartmentId AS slotDepartmentId,

        @studentLevel AS studentLevel,

        @courseLevel AS courseLevel,

        @capacity AS capacity,

        @currentBookings AS currentBookings;

    `);

    const check = checkResult.recordset[0];

    if (!check || check.capacity === null) {

      await transaction.rollback();

      return res.status(404).json({

        success: false,

        message: 'الموعد غير موجود أو غير متاح'

      });

    }

    if (check.studentDepartmentId !== check.slotDepartmentId) {

      await transaction.rollback();

      return res.status(403).json({

        success: false,

        message: 'لا يمكنك حجز موعد خارج قسمك'

      });

    }

    if (check.courseLevel && check.courseLevel !== check.studentLevel) {

      await transaction.rollback();

      return res.status(403).json({

        success: false,

        message: 'لا يمكنك حجز مادة خارج فرقتك الدراسية'

      });

    }

    if (check.currentBookings >= check.capacity) {

      await transaction.rollback();

      return res.status(409).json({

        success: false,

        message: 'هذا الموعد مكتمل بالفعل'

      });

    }

    const insertRequest = new sql.Request(transaction);

    insertRequest.input('student_id', sql.Int, Number(student_id));

    insertRequest.input('slot_id', sql.Int, Number(slot_id));

    await insertRequest.query(`

      INSERT INTO Booking 

      (

        student_id,

        slot_id,

        status

      )

      VALUES 

      (

        @student_id,

        @slot_id,

        'booked'

      )

    `);

    await transaction.commit();

    res.status(201).json({

      success: true,

      message: 'تم حجز الموعد بنجاح'

    });

  } catch (error) {

    if (transaction) {

      try {

        await transaction.rollback();

      } catch {}

    }

    console.error('Booking Error:', error);

    if (error.number === 2627 || error.number === 2601) {

      return res.status(409).json({

        success: false,

        message: 'أنت حجزت هذا الموعد من قبل'

      });

    }

    res.status(500).json({

      success: false,

      message: 'حدث خطأ أثناء حجز الموعد'

    });

  }

});

/* =========================

   My Bookings

========================= */

app.get('/api/students/:studentId/bookings', async (req, res) => {

  try {

    const { studentId } = req.params;

    const pool = await getPool();

    const result = await pool.request()

      .input('student_id', sql.Int, Number(studentId))

      .query(`

        SELECT 

          b.booking_id,

          b.status,

          b.booked_at,

          ts.slot_date,

          ts.start_time,

          ts.end_time,

          p.full_name AS professor_name,

          d.department_name_ar,

          at.type_name,

          at.duration_minutes,

          c.course_name

        FROM Booking b

        JOIN TimeSlot ts ON b.slot_id = ts.slot_id

        JOIN Professor p ON ts.professor_id = p.professor_id

        JOIN Department d ON p.department_id = d.department_id

        JOIN AppointmentType at ON ts.type_id = at.type_id

        LEFT JOIN Course c ON ts.course_id = c.course_id

        WHERE b.student_id = @student_id

        ORDER BY ts.slot_date DESC, ts.start_time DESC

      `);

    res.json({

      success: true,

      bookings: result.recordset

    });

  } catch (error) {

    console.error('My Bookings Error:', error);

    res.status(500).json({

      success: false,

      message: 'حدث خطأ أثناء جلب الحجوزات'

    });

  }

});

/* =========================

   Cancel Booking

========================= */

app.patch('/api/bookings/:bookingId/cancel', async (req, res) => {

  try {

    const { bookingId } = req.params;

    const { student_id } = req.body;

    if (!student_id) {

      return res.status(400).json({

        success: false,

        message: 'student_id مطلوب'

      });

    }

    const pool = await getPool();

    const result = await pool.request()

      .input('booking_id', sql.Int, Number(bookingId))

      .input('student_id', sql.Int, Number(student_id))

      .query(`

        UPDATE Booking

        SET status = 'cancelled'

        WHERE booking_id = @booking_id

          AND student_id = @student_id

          AND status = 'booked';

        SELECT @@ROWCOUNT AS affectedRows;

      `);

    if (result.recordset[0].affectedRows === 0) {

      return res.status(404).json({

        success: false,

        message: 'الحجز غير موجود أو تم إلغاؤه بالفعل'

      });

    }

    res.json({

      success: true,

      message: 'تم إلغاء الحجز بنجاح'

    });

  } catch (error) {

    console.error('Cancel Booking Error:', error);

    res.status(500).json({

      success: false,

      message: 'حدث خطأ أثناء إلغاء الحجز'

    });

  }

});

/* =========================

   Start Server

========================= */

app.listen(PORT, () => {

  console.log(`🚀 Server running on http://localhost:${PORT}`);

});