-- Production Database Schema for HR AI SaaS
-- Enhanced with security, performance, and audit features

-- ==============================================
-- Core Tables
-- ==============================================

-- Users table (if not using external auth)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
BEGIN
    CREATE TABLE users (
        id NVARCHAR(50) PRIMARY KEY,
        email NVARCHAR(255) UNIQUE NOT NULL,
        firstName NVARCHAR(100),
        lastName NVARCHAR(100),
        roles NVARCHAR(500) DEFAULT 'user', -- JSON array of roles
        isActive BIT DEFAULT 1,
        createdAt DATETIME2 DEFAULT GETDATE(),
        updatedAt DATETIME2 DEFAULT GETDATE(),
        lastLoginAt DATETIME2,
        
        -- Audit fields
        createdBy NVARCHAR(50),
        updatedBy NVARCHAR(50),
        
        -- Indexes
        INDEX IX_users_email (email),
        INDEX IX_users_isActive (isActive),
        INDEX IX_users_createdAt (createdAt)
    )
END

-- Batch sessions with enhanced tracking
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'batch_sessions')
BEGIN
    CREATE TABLE batch_sessions (
        sessionId NVARCHAR(50) PRIMARY KEY,
        userId NVARCHAR(50) NOT NULL,
        roleId NVARCHAR(50),
        status NVARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'completed_with_errors', 'failed', 'cancelled')),
        totalFiles INT DEFAULT 0,
        totalProcessed INT DEFAULT 0,
        totalFailed INT DEFAULT 0,
        createdAt DATETIME2 DEFAULT GETDATE(),
        completedAt DATETIME2,
        
        -- Cost tracking
        totalCost DECIMAL(10,6) DEFAULT 0,
        estimatedCost DECIMAL(10,6) DEFAULT 0,
        
        -- Processing metrics
        avgProcessingTimeSeconds INT,
        avgScore DECIMAL(5,2),
        
        -- Audit fields
        createdBy NVARCHAR(50),
        updatedBy NVARCHAR(50),
        updatedAt DATETIME2 DEFAULT GETDATE(),
        
        -- Foreign keys
        FOREIGN KEY (userId) REFERENCES users(id),
        
        -- Indexes
        INDEX IX_batch_sessions_userId (userId),
        INDEX IX_batch_sessions_status (status),
        INDEX IX_batch_sessions_createdAt (createdAt),
        INDEX IX_batch_sessions_userId_status (userId, status)
    )
END

-- Enhanced uploaded files table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'uploaded_files')
BEGIN
    CREATE TABLE uploaded_files (
        id NVARCHAR(50) PRIMARY KEY,
        userId NVARCHAR(50) NOT NULL,
        sessionId NVARCHAR(50),
        roleId NVARCHAR(50),
        fileName NVARCHAR(255) NOT NULL,
        originalFilename NVARCHAR(255),
        fileSizeBytes BIGINT,
        fileUrl NVARCHAR(1000),
        blobName NVARCHAR(1000),
        contentType NVARCHAR(100) DEFAULT 'application/pdf',
        
        -- Processing status and tracking
        processingStatus NVARCHAR(20) DEFAULT 'uploaded' CHECK (processingStatus IN ('uploaded', 'processing', 'analyzing', 'analyzed', 'failed')),
        processingStartedAt DATETIME2,
        processingCompletedAt DATETIME2,
        processingTimeSeconds INT,
        
        -- Text extraction
        extractedText NTEXT,
        extractionConfidence DECIMAL(5,2),
        extractionMetadata NVARCHAR(MAX), -- JSON
        
        -- Error handling
        errorMessage NTEXT,
        retryCount INT DEFAULT 0,
        lastRetryAt DATETIME2,
        
        -- Timestamps
        uploadedDate DATETIME2 DEFAULT GETDATE(),
        processedDate DATETIME2,
        
        -- Audit fields
        createdBy NVARCHAR(50),
        updatedBy NVARCHAR(50),
        updatedAt DATETIME2 DEFAULT GETDATE(),
        
        -- Foreign keys
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (sessionId) REFERENCES batch_sessions(sessionId),
        
        -- Indexes
        INDEX IX_uploaded_files_userId (userId),
        INDEX IX_uploaded_files_sessionId (sessionId),
        INDEX IX_uploaded_files_status (processingStatus),
        INDEX IX_uploaded_files_uploadedDate (uploadedDate),
        INDEX IX_uploaded_files_userId_sessionId (userId, sessionId),
        INDEX IX_uploaded_files_status_uploadedDate (processingStatus, uploadedDate)
    )
END

-- Enhanced roles table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'roles')
BEGIN
    CREATE TABLE roles (
        id NVARCHAR(50) PRIMARY KEY,
        userId NVARCHAR(50) NOT NULL,
        title NVARCHAR(200) NOT NULL,
        description NTEXT,
        department NVARCHAR(100),
        
        -- Role settings
        isActive BIT DEFAULT 1,
        isTemplate BIT DEFAULT 0,
        templateCategory NVARCHAR(100),
        
        -- Usage tracking
        usageCount INT DEFAULT 0,
        lastUsedAt DATETIME2,
        
        -- Experience requirements
        minExperience INT,
        maxExperience INT,
        
        -- Timestamps
        createdAt DATETIME2 DEFAULT GETDATE(),
        updatedAt DATETIME2 DEFAULT GETDATE(),
        
        -- Audit fields
        createdBy NVARCHAR(50),
        updatedBy NVARCHAR(50),
        
        -- Foreign keys
        FOREIGN KEY (userId) REFERENCES users(id),
        
        -- Indexes
        INDEX IX_roles_userId (userId),
        INDEX IX_roles_isActive (isActive),
        INDEX IX_roles_isTemplate (isTemplate),
        INDEX IX_roles_department (department),
        INDEX IX_roles_createdAt (createdAt)
    )
END

-- Enhanced role skills
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'role_skills')
BEGIN
    CREATE TABLE role_skills (
        id NVARCHAR(50) PRIMARY KEY DEFAULT NEWID(),
        roleId NVARCHAR(50) NOT NULL,
        skillName NVARCHAR(200) NOT NULL,
        weight INT NOT NULL CHECK (weight BETWEEN 1 AND 10),
        isRequired BIT DEFAULT 0,
        category NVARCHAR(100),
        
        -- Skill details
        description NTEXT,
        skillType NVARCHAR(50) CHECK (skillType IN ('technical', 'soft', 'domain', 'language', 'certification')),
        proficiencyLevel NVARCHAR(50) CHECK (proficiencyLevel IN ('beginner', 'intermediate', 'advanced', 'expert')),
        
        -- Timestamps
        createdAt DATETIME2 DEFAULT GETDATE(),
        updatedAt DATETIME2 DEFAULT GETDATE(),
        
        -- Foreign keys
        FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE CASCADE,
        
        -- Indexes
        INDEX IX_role_skills_roleId (roleId),
        INDEX IX_role_skills_isRequired (isRequired),
        INDEX IX_role_skills_weight (weight DESC),
        INDEX IX_role_skills_category (category),
        INDEX IX_role_skills_skillName (skillName)
    )
END

-- Enhanced role questions
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'role_questions')
BEGIN
    CREATE TABLE role_questions (
        id NVARCHAR(50) PRIMARY KEY DEFAULT NEWID(),
        roleId NVARCHAR(50) NOT NULL,
        questionText NVARCHAR(2000) NOT NULL,
        weight INT NOT NULL CHECK (weight BETWEEN 1 AND 10),
        category NVARCHAR(100),
        
        -- Question details
        questionType NVARCHAR(50) CHECK (questionType IN ('experience', 'technical', 'behavioral', 'situational')),
        expectedAnswerType NVARCHAR(50) CHECK (expectedAnswerType IN ('text', 'numeric', 'boolean', 'multiple_choice')),
        expectedAnswerFormat NVARCHAR(1000), -- JSON for complex answer formats
        
        -- Timestamps
        createdAt DATETIME2 DEFAULT GETDATE(),
        updatedAt DATETIME2 DEFAULT GETDATE(),
        
        -- Foreign keys
        FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE CASCADE,
        
        -- Indexes
        INDEX IX_role_questions_roleId (roleId),
        INDEX IX_role_questions_weight (weight DESC),
        INDEX IX_role_questions_category (category),
        INDEX IX_role_questions_questionType (questionType)
    )
END

-- Enhanced resume analysis results
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'resume_analysis_results')
BEGIN
    CREATE TABLE resume_analysis_results (
        id NVARCHAR(50) PRIMARY KEY,
        fileId NVARCHAR(50) NOT NULL,
        roleId NVARCHAR(50) NOT NULL,
        sessionId NVARCHAR(50),
        
        -- Scores
        overallScore INT CHECK (overallScore BETWEEN 0 AND 100),
        technicalScore INT CHECK (technicalScore BETWEEN 0 AND 100),
        experienceScore INT CHECK (experienceScore BETWEEN 0 AND 100),
        educationScore INT CHECK (educationScore BETWEEN 0 AND 100),
        skillsScore INT CHECK (skillsScore BETWEEN 0 AND 100),
        cultureFitScore INT CHECK (cultureFitScore BETWEEN 0 AND 100),
        
        -- Analysis content
        executiveSummary NTEXT,
        detailedAnalysis NTEXT,
        topStrengths NTEXT, -- JSON array
        concernsGaps NTEXT, -- JSON array
        redFlags NTEXT, -- JSON array
        standoutAchievements NTEXT, -- JSON array
        interviewQuestions NTEXT, -- JSON array
        
        -- Recommendation
        recommendation NVARCHAR(20) CHECK (recommendation IN ('accept', 'maybe', 'reject')),
        recommendationReason NTEXT,
        recommendationConfidence DECIMAL(5,2),
        
        -- Skills analysis
        matchedSkills NTEXT, -- JSON object
        missingRequiredSkills NTEXT, -- JSON array
        skillsGapAnalysis NTEXT, -- JSON object
        
        -- AI metadata
        aiModelUsed NVARCHAR(200),
        aiModelVersion NVARCHAR(100),
        processingTimeSeconds INT,
        tokensUsed INT,
        aiCost DECIMAL(10,6),
        
        -- Quality metrics
        analysisQualityScore DECIMAL(5,2),
        responseCompleteness DECIMAL(5,2),
        
        -- Timestamps
        createdDate DATETIME2 DEFAULT GETDATE(),
        updatedDate DATETIME2 DEFAULT GETDATE(),
        
        -- Audit fields
        createdBy NVARCHAR(50),
        updatedBy NVARCHAR(50),
        
        -- Foreign keys
        FOREIGN KEY (fileId) REFERENCES uploaded_files(id),
        FOREIGN KEY (roleId) REFERENCES roles(id),
        FOREIGN KEY (sessionId) REFERENCES batch_sessions(sessionId),
        
        -- Indexes
        INDEX IX_resume_analysis_fileId (fileId),
        INDEX IX_resume_analysis_roleId (roleId),
        INDEX IX_resume_analysis_sessionId (sessionId),
        INDEX IX_resume_analysis_overallScore (overallScore DESC),
        INDEX IX_resume_analysis_recommendation (recommendation),
        INDEX IX_resume_analysis_createdDate (createdDate),
        INDEX IX_resume_analysis_roleId_overallScore (roleId, overallScore DESC),
        INDEX IX_resume_analysis_sessionId_overallScore (sessionId, overallScore DESC)
    )
END

-- Skills analysis detail table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'skills_analysis')
BEGIN
    CREATE TABLE skills_analysis (
        id NVARCHAR(50) PRIMARY KEY,
        analysisId NVARCHAR(50) NOT NULL,
        skillName NVARCHAR(200) NOT NULL,
        isMatched BIT NOT NULL,
        matchStrength DECIMAL(5,2), -- How strong the match is (0-100)
        evidence NTEXT, -- Text evidence from resume
        confidence DECIMAL(5,2), -- AI confidence in this match
        skillCategory NVARCHAR(100),
        isRequired BIT DEFAULT 0,
        skillWeight INT,
        
        -- Timestamps
        createdDate DATETIME2 DEFAULT GETDATE(),
        
        -- Foreign keys
        FOREIGN KEY (analysisId) REFERENCES resume_analysis_results(id) ON DELETE CASCADE,
        
        -- Indexes
        INDEX IX_skills_analysis_analysisId (analysisId),
        INDEX IX_skills_analysis_skillName (skillName),
        INDEX IX_skills_analysis_isMatched (isMatched),
        INDEX IX_skills_analysis_matchStrength (matchStrength DESC),
        INDEX IX_skills_analysis_isRequired (isRequired)
    )
END

-- Questions analysis detail table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'questions_analysis')
BEGIN
    CREATE TABLE questions_analysis (
        id NVARCHAR(50) PRIMARY KEY,
        analysisId NVARCHAR(50) NOT NULL,
        questionText NVARCHAR(2000) NOT NULL,
        aiAnswer NTEXT,
        evidence NTEXT,
        confidence DECIMAL(5,2),
        score DECIMAL(5,2), -- 0-100 score for this question
        questionWeight INT,
        questionCategory NVARCHAR(100),
        
        -- Timestamps
        createdDate DATETIME2 DEFAULT GETDATE(),
        
        -- Foreign keys
        FOREIGN KEY (analysisId) REFERENCES resume_analysis_results(id) ON DELETE CASCADE,
        
        -- Indexes
        INDEX IX_questions_analysis_analysisId (analysisId),
        INDEX IX_questions_analysis_score (score DESC),
        INDEX IX_questions_analysis_questionCategory (questionCategory)
    )
END

-- ==============================================
-- Cost and Usage Tracking Tables
-- ==============================================

-- User AI costs tracking
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_ai_costs')
BEGIN
    CREATE TABLE user_ai_costs (
        userId NVARCHAR(50) PRIMARY KEY,
        dailyCost DECIMAL(10,6) DEFAULT 0,
        monthlyCost DECIMAL(10,6) DEFAULT 0,
        yearlyTotal DECIMAL(10,6) DEFAULT 0,
        requestCount INT DEFAULT 0,
        lastResetDaily DATETIME2 DEFAULT GETDATE(),
        lastResetMonthly DATETIME2 DEFAULT GETDATE(),
        createdAt DATETIME2 DEFAULT GETDATE(),
        updatedAt DATETIME2 DEFAULT GETDATE(),
        
        -- Foreign keys
        FOREIGN KEY (userId) REFERENCES users(id),
        
        -- Indexes
        INDEX IX_user_ai_costs_dailyCost (dailyCost DESC),
        INDEX IX_user_ai_costs_monthlyCost (monthlyCost DESC),
        INDEX IX_user_ai_costs_updatedAt (updatedAt)
    )
END

-- System usage metrics
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'usage_metrics')
BEGIN
    CREATE TABLE usage_metrics (
        id NVARCHAR(50) PRIMARY KEY DEFAULT NEWID(),
        metricDate DATE NOT NULL,
        metricHour INT CHECK (metricHour BETWEEN 0 AND 23),
        
        -- Metrics
        totalUsers INT DEFAULT 0,
        activeUsers INT DEFAULT 0,
        newUsers INT DEFAULT 0,
        totalSessions INT DEFAULT 0,
        totalFiles INT DEFAULT 0,
        totalAnalyses INT DEFAULT 0,
        totalCost DECIMAL(10,6) DEFAULT 0,
        avgProcessingTime DECIMAL(10,2), -- seconds
        successRate DECIMAL(5,2), -- percentage
        
        -- Performance metrics
        avgResponseTime DECIMAL(10,2), -- milliseconds
        errorCount INT DEFAULT 0,
        
        -- Timestamps
        createdAt DATETIME2 DEFAULT GETDATE(),
        
        -- Indexes
        INDEX IX_usage_metrics_date (metricDate DESC),
        INDEX IX_usage_metrics_date_hour (metricDate, metricHour),
        UNIQUE INDEX UQ_usage_metrics_date_hour (metricDate, metricHour)
    )
END

-- ==============================================
-- Audit and Security Tables
-- ==============================================

-- Audit log for security events
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'security_audit_log')
BEGIN
    CREATE TABLE security_audit_log (
        id NVARCHAR(50) PRIMARY KEY DEFAULT NEWID(),
        userId NVARCHAR(50),
        eventType NVARCHAR(100) NOT NULL,
        eventDescription NVARCHAR(1000),
        ipAddress NVARCHAR(45),
        userAgent NVARCHAR(1000),
        resourceType NVARCHAR(100),
        resourceId NVARCHAR(50),
        
        -- Event details
        success BIT DEFAULT 1,
        errorMessage NTEXT,
        additionalData NVARCHAR(MAX), -- JSON
        
        -- Risk scoring
        riskLevel NVARCHAR(20) CHECK (riskLevel IN ('low', 'medium', 'high', 'critical')),
        riskScore INT CHECK (riskScore BETWEEN 0 AND 100),
        
        -- Timestamps
        eventTimestamp DATETIME2 DEFAULT GETDATE(),
        
        -- Indexes
        INDEX IX_security_audit_userId (userId),
        INDEX IX_security_audit_eventType (eventType),
        INDEX IX_security_audit_timestamp (eventTimestamp DESC),
        INDEX IX_security_audit_riskLevel (riskLevel),
        INDEX IX_security_audit_success (success),
        INDEX IX_security_audit_userId_timestamp (userId, eventTimestamp DESC)
    )
END

-- Rate limiting tracking (complement to in-memory)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'rate_limit_violations')
BEGIN
    CREATE TABLE rate_limit_violations (
        id NVARCHAR(50) PRIMARY KEY DEFAULT NEWID(),
        userId NVARCHAR(50),
        ipAddress NVARCHAR(45),
        limitType NVARCHAR(50) NOT NULL, -- 'api', 'ai', 'user'
        violationCount INT DEFAULT 1,
        windowStart DATETIME2 NOT NULL,
        windowEnd DATETIME2 NOT NULL,
        blocked BIT DEFAULT 0,
        
        -- Timestamps
        firstViolation DATETIME2 DEFAULT GETDATE(),
        lastViolation DATETIME2 DEFAULT GETDATE(),
        
        -- Indexes
        INDEX IX_rate_limit_userId (userId),
        INDEX IX_rate_limit_ipAddress (ipAddress),
        INDEX IX_rate_limit_limitType (limitType),
        INDEX IX_rate_limit_windowEnd (windowEnd),
        INDEX IX_rate_limit_blocked (blocked)
    )
END

-- ==============================================
-- Performance Optimization
-- ==============================================

-- Additional indexes for common queries
CREATE NONCLUSTERED INDEX IX_uploaded_files_userId_status_date 
ON uploaded_files (userId, processingStatus, uploadedDate DESC)

CREATE NONCLUSTERED INDEX IX_resume_analysis_results_composite
ON resume_analysis_results (sessionId, overallScore DESC, recommendation)
INCLUDE (fileId, executiveSummary, detailedAnalysis)

-- Statistics for query optimization
UPDATE STATISTICS uploaded_files
UPDATE STATISTICS resume_analysis_results
UPDATE STATISTICS batch_sessions

-- ==============================================
-- Views for Common Queries
-- ==============================================

-- User dashboard summary view
IF NOT EXISTS (SELECT * FROM sys.views WHERE name = 'user_dashboard_summary')
BEGIN
    EXEC('
    CREATE VIEW user_dashboard_summary AS
    SELECT 
        u.id as userId,
        u.email,
        u.firstName,
        u.lastName,
        COUNT(DISTINCT bs.sessionId) as totalSessions,
        COUNT(DISTINCT uf.id) as totalFiles,
        COUNT(DISTINCT CASE WHEN uf.processingStatus = ''analyzed'' THEN uf.id END) as analyzedFiles,
        AVG(CASE WHEN rar.overallScore IS NOT NULL THEN rar.overallScore END) as avgScore,
        SUM(CASE WHEN uc.dailyCost IS NOT NULL THEN uc.dailyCost ELSE 0 END) as dailyCost,
        SUM(CASE WHEN uc.monthlyCost IS NOT NULL THEN uc.monthlyCost ELSE 0 END) as monthlyCost,
        MAX(bs.createdAt) as lastSessionDate
    FROM users u
    LEFT JOIN batch_sessions bs ON u.id = bs.userId
    LEFT JOIN uploaded_files uf ON bs.sessionId = uf.sessionId
    LEFT JOIN resume_analysis_results rar ON uf.id = rar.fileId
    LEFT JOIN user_ai_costs uc ON u.id = uc.userId
    GROUP BY u.id, u.email, u.firstName, u.lastName
    ')
END

-- Session progress view
IF NOT EXISTS (SELECT * FROM sys.views WHERE name = 'session_progress_view')
BEGIN
    EXEC('
    CREATE VIEW session_progress_view AS
    SELECT 
        bs.sessionId,
        bs.userId,
        bs.status,
        bs.totalFiles,
        bs.createdAt,
        bs.completedAt,
        COUNT(uf.id) as currentFiles,
        SUM(CASE WHEN uf.processingStatus = ''uploaded'' THEN 1 ELSE 0 END) as uploadedFiles,
        SUM(CASE WHEN uf.processingStatus = ''processing'' THEN 1 ELSE 0 END) as processingFiles,
        SUM(CASE WHEN uf.processingStatus = ''analyzing'' THEN 1 ELSE 0 END) as analyzingFiles,
        SUM(CASE WHEN uf.processingStatus = ''analyzed'' THEN 1 ELSE 0 END) as analyzedFiles,
        SUM(CASE WHEN uf.processingStatus = ''failed'' THEN 1 ELSE 0 END) as failedFiles,
        AVG(CASE WHEN rar.overallScore IS NOT NULL THEN rar.overallScore END) as avgScore,
        SUM(CASE WHEN rar.aiCost IS NOT NULL THEN rar.aiCost ELSE 0 END) as totalCost,
        CASE 
            WHEN COUNT(uf.id) = 0 THEN 0
            ELSE ROUND(
                (SUM(CASE WHEN uf.processingStatus IN (''analyzed'', ''failed'') THEN 1 ELSE 0 END) * 100.0) / COUNT(uf.id), 
                2
            )
        END as progressPercentage
    FROM batch_sessions bs
    LEFT JOIN uploaded_files uf ON bs.sessionId = uf.sessionId
    LEFT JOIN resume_analysis_results rar ON uf.id = rar.fileId
    GROUP BY bs.sessionId, bs.userId, bs.status, bs.totalFiles, bs.createdAt, bs.completedAt
    ')
END

PRINT 'Production database schema deployment completed successfully!'
PRINT 'Remember to:'
PRINT '1. Configure proper backup strategies'
PRINT '2. Set up monitoring and alerting'
PRINT '3. Review and adjust indexes based on actual usage patterns'
PRINT '4. Implement data retention policies'
PRINT '5. Set up proper user permissions and roles'