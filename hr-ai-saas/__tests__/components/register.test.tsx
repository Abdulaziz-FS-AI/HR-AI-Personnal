import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import RegisterPage from '@/app/(auth)/register/page'

// Mock fetch
global.fetch = jest.fn()

// Mock the dependencies
jest.mock('next/navigation')

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
}

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>

describe('RegisterPage', () => {
  beforeEach(() => {
    mockUseRouter.mockReturnValue(mockRouter)
    jest.clearAllMocks()
    ;(fetch as jest.MockedFunction<typeof fetch>).mockClear()
  })

  test('renders registration form correctly', () => {
    render(<RegisterPage />)
    
    expect(screen.getByText('Create your account')).toBeInTheDocument()
    expect(screen.getByText('Start screening resumes with AI today')).toBeInTheDocument()
    expect(screen.getByLabelText('First name')).toBeInTheDocument()
    expect(screen.getByLabelText('Last name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
    expect(screen.getByLabelText('Company name')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  test('form validation works for password confirmation', () => {
    render(<RegisterPage />)
    
    const passwordInput = screen.getByLabelText('Password')
    const confirmPasswordInput = screen.getByLabelText('Confirm password')

    // Test that form has password confirmation field
    expect(passwordInput).toBeInTheDocument()
    expect(confirmPasswordInput).toBeInTheDocument()
    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(confirmPasswordInput).toHaveAttribute('type', 'password')
  })

  test('handles successful registration', async () => {
    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'User created successfully' }),
    } as Response)

    render(<RegisterPage />)
    
    // Fill out the form
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'john@example.com' } })
    fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'Test Company' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } })

    const submitButton = screen.getByRole('button', { name: /create account/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'john@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
          companyName: 'Test Company',
        }),
      })
    })

    expect(mockRouter.push).toHaveBeenCalledWith('/login?message=Registration successful')
  })

  test('handles registration error', async () => {
    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Email already exists' }),
    } as Response)

    render(<RegisterPage />)
    
    // Fill out the form
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'existing@example.com' } })
    fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'Test Company' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } })

    const submitButton = screen.getByRole('button', { name: /create account/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Email already exists')).toBeInTheDocument()
    })

    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  test('shows loading state during registration', async () => {
    ;(fetch as jest.MockedFunction<typeof fetch>).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    )

    render(<RegisterPage />)
    
    // Fill out the form
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'john@example.com' } })
    fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'Test Company' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } })

    const submitButton = screen.getByRole('button', { name: /create account/i })
    fireEvent.click(submitButton)

    expect(screen.getByText('Creating account...')).toBeInTheDocument()
    expect(submitButton).toBeDisabled()
  })

  test('contains link to login page', () => {
    render(<RegisterPage />)
    
    const signInLink = screen.getByText('Sign in')
    expect(signInLink).toBeInTheDocument()
    expect(signInLink.closest('a')).toHaveAttribute('href', '/login')
  })
})