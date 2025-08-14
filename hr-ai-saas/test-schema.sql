-- Test table creation
CREATE TABLE test_table (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100),
    created_at DATETIME2 DEFAULT GETUTCDATE()
);

-- Insert test data
INSERT INTO test_table (name) VALUES ('Test Entry');

-- Select to verify
SELECT * FROM test_table;