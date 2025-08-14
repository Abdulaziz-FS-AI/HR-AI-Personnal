-- HR AI SaaS Database Schema
-- Azure SQL Database Setup

-- Users table for authentication and company info
CREATE TABLE users (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    email NVARCHAR(255) UNIQUE NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    company_name NVARCHAR(255),
    first_name NVARCHAR(100),
    last_name NVARCHAR(100),
    subscription_tier NVARCHAR(50) DEFAULT 'Professional',
    credits_remaining INT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    is_active BIT DEFAULT 1
);

-- Job roles created by users
CREATE TABLE roles (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL,
    title NVARCHAR(255) NOT NULL,
    description NTEXT,
    responsibilities NTEXT, -- JSON array of bullet points
    department NVARCHAR(100),
    location NVARCHAR(100),
    employment_type NVARCHAR(50), -- full-time, contract, remote, hybrid
    seniority_level NVARCHAR(50), -- entry, mid, senior, executive
    min_experience_years INT,
    max_experience_years INT,
    education_requirements NTEXT,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    is_active BIT DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Skills associated with roles
CREATE TABLE role_skills (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    role_id UNIQUEIDENTIFIER NOT NULL,
    skill_name NVARCHAR(255) NOT NULL,
    weight INT NOT NULL CHECK (weight >= 1 AND weight <= 10),
    is_required BIT DEFAULT 0, -- true for must-have skills (weight 10)
    skill_category NVARCHAR(100), -- technical, soft, tool, certification
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- Custom questions for roles
CREATE TABLE role_questions (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    role_id UNIQUEIDENTIFIER NOT NULL,
    question_text NTEXT NOT NULL,
    weight INT NOT NULL CHECK (weight >= 1 AND weight <= 10),
    category NVARCHAR(100), -- technical, behavioral, cultural, scenario
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- Evaluation sessions (batch resume processing)
CREATE TABLE evaluations (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL,
    role_id UNIQUEIDENTIFIER NOT NULL,
    session_name NVARCHAR(255),
    total_resumes INT DEFAULT 0,
    processed_resumes INT DEFAULT 0,
    failed_resumes INT DEFAULT 0,
    status NVARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    processing_started_at DATETIME2,
    processing_completed_at DATETIME2,
    cost_per_resume DECIMAL(5,2),
    total_cost DECIMAL(10,2),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Individual resume files and metadata
CREATE TABLE resumes (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    evaluation_id UNIQUEIDENTIFIER NOT NULL,
    original_filename NVARCHAR(500) NOT NULL,
    file_size_bytes BIGINT,
    file_url NVARCHAR(1000), -- Azure Blob Storage URL
    candidate_name NVARCHAR(255),
    candidate_email NVARCHAR(255),
    candidate_phone NVARCHAR(50),
    extracted_text NTEXT, -- Full extracted text from PDF
    status NVARCHAR(50) DEFAULT 'uploaded', -- uploaded, processing, analyzed, failed
    uploaded_at DATETIME2 DEFAULT GETUTCDATE(),
    processed_at DATETIME2,
    FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE
);

-- AI analysis results for each resume
CREATE TABLE resume_analyses (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    resume_id UNIQUEIDENTIFIER NOT NULL,
    overall_score INT CHECK (overall_score >= 0 AND overall_score <= 100),
    
    -- Category scores
    technical_score INT CHECK (technical_score >= 0 AND technical_score <= 100),
    experience_score INT CHECK (experience_score >= 0 AND experience_score <= 100),
    education_score INT CHECK (education_score >= 0 AND education_score <= 100),
    skills_score INT CHECK (skills_score >= 0 AND skills_score <= 100),
    culture_fit_score INT CHECK (culture_fit_score >= 0 AND culture_fit_score <= 100),
    
    -- AI-generated content
    executive_summary NTEXT,
    detailed_analysis NTEXT,
    top_strengths NTEXT, -- JSON array of top 5 strengths
    concerns_gaps NTEXT, -- JSON array of top 3 concerns
    red_flags NTEXT, -- JSON array of red flags if any
    standout_achievements NTEXT, -- JSON array of notable achievements
    interview_questions NTEXT, -- JSON array of suggested interview questions
    
    -- Decision recommendation
    recommendation NVARCHAR(50), -- accept, maybe, reject
    recommendation_reason NTEXT,
    
    -- Skills matching details
    matched_skills NTEXT, -- JSON object with skill matching details
    missing_required_skills NTEXT, -- JSON array of missing must-have skills
    
    -- Processing metadata
    ai_model_used NVARCHAR(100),
    processing_time_seconds INT,
    ai_cost DECIMAL(8,4),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    
    FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
);

-- Contact information extracted from resumes
CREATE TABLE candidate_contacts (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    resume_id UNIQUEIDENTIFIER NOT NULL,
    email NVARCHAR(255),
    phone NVARCHAR(50),
    linkedin_url NVARCHAR(500),
    portfolio_url NVARCHAR(500),
    github_url NVARCHAR(500),
    location NVARCHAR(255),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
);

-- User subscription and billing
CREATE TABLE subscriptions (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL,
    tier NVARCHAR(50) NOT NULL, -- professional, enterprise
    credits_purchased INT NOT NULL,
    credits_used INT DEFAULT 0,
    price_per_credit DECIMAL(5,2),
    total_amount DECIMAL(10,2),
    purchase_date DATETIME2 DEFAULT GETUTCDATE(),
    expires_at DATETIME2,
    stripe_payment_id NVARCHAR(255),
    is_active BIT DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Usage analytics and metrics
CREATE TABLE usage_analytics (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL,
    evaluation_id UNIQUEIDENTIFIER,
    metric_type NVARCHAR(100), -- evaluation_created, resume_processed, export_generated
    metric_value INT,
    metadata NTEXT, -- JSON with additional context
    recorded_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE SET NULL
);

-- Processing queue for async resume analysis
CREATE TABLE processing_queue (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    resume_id UNIQUEIDENTIFIER NOT NULL,
    priority INT DEFAULT 5, -- 1 (highest) to 10 (lowest)
    status NVARCHAR(50) DEFAULT 'queued', -- queued, processing, completed, failed
    retry_count INT DEFAULT 0,
    error_message NTEXT,
    assigned_worker NVARCHAR(100),
    queued_at DATETIME2 DEFAULT GETUTCDATE(),
    started_at DATETIME2,
    completed_at DATETIME2,
    FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IX_users_email ON users(email);
CREATE INDEX IX_roles_user_id ON roles(user_id);
CREATE INDEX IX_role_skills_role_id ON role_skills(role_id);
CREATE INDEX IX_role_questions_role_id ON role_questions(role_id);
CREATE INDEX IX_evaluations_user_id_created ON evaluations(user_id, created_at DESC);
CREATE INDEX IX_resumes_evaluation_id ON resumes(evaluation_id);
CREATE INDEX IX_resume_analyses_resume_id ON resume_analyses(resume_id);
CREATE INDEX IX_resume_analyses_overall_score ON resume_analyses(overall_score DESC);
CREATE INDEX IX_processing_queue_status_priority ON processing_queue(status, priority);

-- Sample data for testing
INSERT INTO users (email, password_hash, company_name, first_name, last_name, credits_remaining)
VALUES ('test@example.com', 'hashed_password_here', 'Test Company', 'John', 'Doe', 100);