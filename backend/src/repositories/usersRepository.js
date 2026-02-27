const { query } = require('../db/pool');

function mapUserRow(row) {
  return {
    id: String(row.id),
    fullName: row.full_name,
    jobTitle: row.job_title,
    specialization: row.specialization,
    animalTypes: row.animal_types || [],
    animalSizes: row.animal_sizes || [],
    fullShift: Boolean(row.full_shift),
    workSchedule: row.work_schedule || [],
    email: row.email,
    phone: row.phone,
    services: row.services || [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function getAllUsers() {
  const result = await query(
    `
      SELECT
        id,
        full_name,
        job_title,
        specialization,
        animal_types,
        animal_sizes,
        full_shift,
        work_schedule,
        email,
        phone,
        services,
        created_at,
        updated_at
      FROM users
      ORDER BY id ASC;
    `
  );

  return result.rows.map(mapUserRow);
}

async function createUser(user) {
  const result = await query(
    `
      INSERT INTO users (
        full_name,
        job_title,
        specialization,
        animal_types,
        animal_sizes,
        full_shift,
        work_schedule,
        email,
        phone,
        services
      )
      VALUES ($1, $2, $3, $4::text[], $5::text[], $6, $7::jsonb, $8, $9, $10::text[])
      RETURNING
        id,
        full_name,
        job_title,
        specialization,
        animal_types,
        animal_sizes,
        full_shift,
        work_schedule,
        email,
        phone,
        services,
        created_at,
        updated_at;
    `,
    [
      user.fullName,
      user.jobTitle,
      user.specialization || null,
      user.animalTypes || [],
      user.animalSizes || [],
      Boolean(user.fullShift),
      JSON.stringify(user.workSchedule || []),
      user.email,
      user.phone,
      user.services || [],
    ]
  );

  return mapUserRow(result.rows[0]);
}

async function updateUser(id, user) {
  const result = await query(
    `
      UPDATE users
      SET
        full_name = $2,
        job_title = $3,
        specialization = $4,
        animal_types = $5::text[],
        animal_sizes = $6::text[],
        full_shift = $7,
        work_schedule = $8::jsonb,
        email = $9,
        phone = $10,
        services = $11::text[],
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        full_name,
        job_title,
        specialization,
        animal_types,
        animal_sizes,
        full_shift,
        work_schedule,
        email,
        phone,
        services,
        created_at,
        updated_at;
    `,
    [
      id,
      user.fullName,
      user.jobTitle,
      user.specialization || null,
      user.animalTypes || [],
      user.animalSizes || [],
      Boolean(user.fullShift),
      JSON.stringify(user.workSchedule || []),
      user.email,
      user.phone,
      user.services || [],
    ]
  );

  return result.rows[0] ? mapUserRow(result.rows[0]) : null;
}

async function deleteUser(id) {
  const result = await query(
    `
      DELETE FROM users
      WHERE id = $1
      RETURNING id;
    `,
    [id]
  );

  return Boolean(result.rows[0]);
}

async function isEmailAvailable(email, excludeId = null) {
  const hasExclude = Number.isInteger(excludeId) && excludeId > 0;
  const result = await query(
    `
      SELECT 1
      FROM users
      WHERE LOWER(email) = LOWER($1)
        AND ($2::bigint IS NULL OR id <> $2::bigint)
      LIMIT 1;
    `,
    [email, hasExclude ? excludeId : null]
  );

  return result.rowCount === 0;
}

module.exports = {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  isEmailAvailable,
};
