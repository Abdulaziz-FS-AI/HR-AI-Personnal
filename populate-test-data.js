const sql = require('mssql');

const config = {
  server: 'hr-ai-saas-server.database.windows.net',
  database: 'hr-ai-saas-db',
  user: 'hradmin',
  password: 'Complex@Pass123!',
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

async function populateTestData() {
  console.log('🎯 Populating Test Data for HR AI SaaS');
  console.log('=====================================\n');

  let pool;
  try {
    pool = await sql.connect(config);
    console.log('✅ Connected to Azure SQL Database\n');

    // Get a user to assign roles to
    const users = await pool.request().query(`
      SELECT TOP 1 id, email FROM users 
      WHERE email = 'abdulaziz.fs.ai@gmail.com'
    `);
    
    if (users.recordset.length === 0) {
      console.error('❌ No user found');
      return;
    }

    const userId = users.recordset[0].id;
    console.log(`📧 Using user: ${users.recordset[0].email}`);
    console.log(`🆔 User ID: ${userId}\n`);

    // Create a comprehensive test role
    console.log('📝 Creating comprehensive test role...');
    
    const roleResult = await pool.request()
      .input('userId', sql.UniqueIdentifier, userId)
      .input('title', sql.NVarChar, 'Senior Full Stack Developer')
      .input('description', sql.NText, 'We are looking for an experienced Senior Full Stack Developer to join our engineering team. You will be responsible for designing, developing, and maintaining both front-end and back-end components of our web applications.')
      .input('responsibilities', sql.NText, `
        • Design and develop scalable web applications using modern frameworks
        • Collaborate with cross-functional teams to define and implement new features
        • Write clean, maintainable, and efficient code
        • Conduct code reviews and mentor junior developers
        • Optimize applications for maximum speed and scalability
        • Troubleshoot and debug applications
        • Stay up-to-date with emerging technologies
      `)
      .input('department', sql.NVarChar, 'Engineering')
      .input('location', sql.NVarChar, 'Remote')
      .input('employmentType', sql.NVarChar, 'full-time')
      .input('seniorityLevel', sql.NVarChar, 'senior')
      .input('minExperienceYears', sql.Int, 5)
      .input('maxExperienceYears', sql.Int, 10)
      .input('educationRequirements', sql.NText, "Bachelor's degree in Computer Science or related field, or equivalent experience")
      .query(`
        INSERT INTO roles (
          id, user_id, title, description, responsibilities, department, location,
          employment_type, seniority_level, min_experience_years, max_experience_years,
          education_requirements, is_active, created_at, updated_at
        )
        VALUES (
          NEWID(), @userId, @title, @description, @responsibilities, @department, @location,
          @employmentType, @seniorityLevel, @minExperienceYears, @maxExperienceYears,
          @educationRequirements, 1, GETDATE(), GETDATE()
        )
        SELECT SCOPE_IDENTITY() as id
      `);

    // Get the created role ID
    const getRoleId = await pool.request()
      .input('userId', sql.UniqueIdentifier, userId)
      .input('title', sql.NVarChar, 'Senior Full Stack Developer')
      .query(`
        SELECT TOP 1 id FROM roles 
        WHERE user_id = @userId AND title = @title
        ORDER BY created_at DESC
      `);

    const roleId = getRoleId.recordset[0].id;
    console.log(`✅ Role created with ID: ${roleId}\n`);

    // Add comprehensive skills
    console.log('🎯 Adding comprehensive skills...');
    const skills = [
      { name: 'JavaScript', weight: 10, required: true },
      { name: 'TypeScript', weight: 9, required: true },
      { name: 'React', weight: 10, required: true },
      { name: 'Node.js', weight: 10, required: true },
      { name: 'Next.js', weight: 8, required: false },
      { name: 'SQL/Database', weight: 8, required: true },
      { name: 'REST APIs', weight: 9, required: true },
      { name: 'Git/Version Control', weight: 8, required: true },
      { name: 'AWS/Azure/Cloud', weight: 7, required: false },
      { name: 'Docker', weight: 6, required: false },
      { name: 'CI/CD', weight: 6, required: false },
      { name: 'Testing/TDD', weight: 7, required: true },
      { name: 'Agile/Scrum', weight: 6, required: false },
      { name: 'System Design', weight: 8, required: true },
      { name: 'Problem Solving', weight: 10, required: true }
    ];

    for (const skill of skills) {
      await pool.request()
        .input('roleId', sql.UniqueIdentifier, roleId)
        .input('skillName', sql.NVarChar, skill.name)
        .input('weight', sql.Int, skill.weight)
        .input('isRequired', sql.Bit, skill.required)
        .query(`
          INSERT INTO role_skills (id, role_id, skill_name, weight, is_required, created_at)
          VALUES (NEWID(), @roleId, @skillName, @weight, @isRequired, GETDATE())
        `);
      console.log(`  ✅ Added skill: ${skill.name} (weight: ${skill.weight}, required: ${skill.required})`);
    }

    // Add evaluation questions
    console.log('\n❓ Adding evaluation questions...');
    const questions = [
      { 
        question: 'What is the candidate\'s experience with React and modern frontend frameworks?',
        weight: 10
      },
      { 
        question: 'Does the candidate have experience with Node.js and backend development?',
        weight: 10
      },
      { 
        question: 'What databases has the candidate worked with?',
        weight: 8
      },
      { 
        question: 'Does the candidate have experience with cloud platforms (AWS, Azure, GCP)?',
        weight: 7
      },
      { 
        question: 'What is the candidate\'s experience with CI/CD and DevOps practices?',
        weight: 6
      },
      { 
        question: 'Has the candidate led technical projects or mentored other developers?',
        weight: 8
      },
      { 
        question: 'Does the candidate demonstrate strong problem-solving skills?',
        weight: 9
      },
      { 
        question: 'What is the candidate\'s experience with testing and code quality?',
        weight: 7
      },
      { 
        question: 'Does the candidate have experience with microservices architecture?',
        weight: 6
      },
      { 
        question: 'Overall, how well does this candidate match our requirements?',
        weight: 10
      }
    ];

    for (const q of questions) {
      await pool.request()
        .input('roleId', sql.UniqueIdentifier, roleId)
        .input('question', sql.NText, q.question)
        .input('weight', sql.Int, q.weight)
        .query(`
          INSERT INTO role_questions (id, role_id, question_text, weight, created_at)
          VALUES (NEWID(), @roleId, @question, @weight, GETDATE())
        `);
      console.log(`  ✅ Added question: "${q.question.substring(0, 50)}..."`);
    }

    // Add role requirements
    console.log('\n📋 Adding role requirements...');
    const requirements = [
      { type: 'experience', value: '5+ years of full-stack development experience', required: true, priority: 10 },
      { type: 'education', value: 'Bachelor\'s degree in Computer Science or equivalent', required: false, priority: 7 },
      { type: 'technical', value: 'Strong proficiency in JavaScript and TypeScript', required: true, priority: 10 },
      { type: 'technical', value: 'Experience with React and Node.js', required: true, priority: 10 },
      { type: 'technical', value: 'Experience with SQL and NoSQL databases', required: true, priority: 8 },
      { type: 'soft', value: 'Excellent communication and collaboration skills', required: true, priority: 8 },
      { type: 'soft', value: 'Strong problem-solving abilities', required: true, priority: 9 },
      { type: 'certification', value: 'AWS or Azure certification', required: false, priority: 5 },
      { type: 'other', value: 'Portfolio or GitHub with relevant projects', required: false, priority: 6 }
    ];

    for (const req of requirements) {
      await pool.request()
        .input('roleId', sql.UniqueIdentifier, roleId)
        .input('requirementType', sql.NVarChar, req.type)
        .input('requirementValue', sql.NText, req.value)
        .input('isRequired', sql.Bit, req.required)
        .input('priority', sql.Int, req.priority)
        .query(`
          INSERT INTO role_requirements (
            id, role_id, requirement_type, requirement_value, 
            is_required, priority, created_at, updated_at
          )
          VALUES (
            NEWID(), @roleId, @requirementType, @requirementValue,
            @isRequired, @priority, GETDATE(), GETDATE()
          )
        `);
      console.log(`  ✅ Added requirement: ${req.value.substring(0, 40)}... (${req.type})`);
    }

    console.log('\n🎉 Test data population completed successfully!');
    console.log('📊 Summary:');
    console.log('  • 1 comprehensive role created');
    console.log(`  • ${skills.length} skills added`);
    console.log(`  • ${questions.length} evaluation questions added`);
    console.log(`  • ${requirements.length} role requirements added`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

populateTestData();