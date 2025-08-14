"use client"

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { 
  User,
  Building,
  CreditCard,
  Bell,
  Shield,
  Key,
  Mail,
  Phone,
  Globe,
  Save,
  Edit,
  Check,
  AlertCircle,
  Crown,
  Zap,
  Settings as SettingsIcon
} from 'lucide-react'

export default function SettingsPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState('profile')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    phone: '',
    timezone: 'America/New_York',
    notifications: {
      email: true,
      sms: false,
      evaluationComplete: true,
      weeklyReport: true,
      systemUpdates: false
    },
    privacy: {
      analyticsTracking: true,
      dataProfiling: false,
      thirdPartyIntegrations: true
    }
  })

  useEffect(() => {
    if (session?.user) {
      setFormData(prev => ({
        ...prev,
        firstName: session.user.name?.split(' ')[0] || '',
        lastName: session.user.name?.split(' ').slice(1).join(' ') || '',
        email: session.user.email || '',
        company: (session.user as any).company || ''
      }))
      setIsLoading(false)
    }
  }, [session])

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'api', label: 'API Keys', icon: Key }
  ]

  const handleSave = async () => {
    setIsSaving(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsSaving(false)
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleNestedChange = (section: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev] as any,
        [field]: value
      }
    }))
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">
          Manage your account preferences and configurations
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-4">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        activeTab === tab.id
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-3" />
                      {tab.label}
                    </button>
                  )
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Profile Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => handleInputChange('company', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={formData.timezone} onValueChange={(value) => handleInputChange('timezone', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      <SelectItem value="Europe/London">London (GMT)</SelectItem>
                      <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <SettingsIcon className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Billing Tab */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CreditCard className="w-5 h-5 mr-2" />
                    Subscription Plan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Crown className="w-8 h-8 text-yellow-500" />
                      <div>
                        <h3 className="font-semibold">Professional Plan</h3>
                        <p className="text-sm text-gray-600">Up to 500 evaluations per month</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">$49<span className="text-sm font-normal text-gray-600">/month</span></p>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                  </div>
                  
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Credits Used This Month:</span>
                      <span>247 / 500</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Billing Cycle:</span>
                      <span>Monthly</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Next Billing Date:</span>
                      <span>February 15, 2024</span>
                    </div>
                  </div>

                  <div className="mt-6 flex space-x-3">
                    <Button variant="outline">Change Plan</Button>
                    <Button variant="outline">View Billing History</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Payment Method</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <CreditCard className="w-6 h-6 text-gray-400" />
                      <div>
                        <p className="font-medium">•••• •••• •••• 4242</p>
                        <p className="text-sm text-gray-600">Expires 12/25</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4 mr-2" />
                      Update
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="w-5 h-5 mr-2" />
                  Notification Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Delivery Methods</h4>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <div>
                        <Label>Email Notifications</Label>
                        <p className="text-sm text-gray-600">Receive notifications via email</p>
                      </div>
                    </div>
                    <Switch
                      checked={formData.notifications.email}
                      onCheckedChange={(checked) => handleNestedChange('notifications', 'email', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <div>
                        <Label>SMS Notifications</Label>
                        <p className="text-sm text-gray-600">Receive notifications via text message</p>
                      </div>
                    </div>
                    <Switch
                      checked={formData.notifications.sms}
                      onCheckedChange={(checked) => handleNestedChange('notifications', 'sms', checked)}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Notification Types</h4>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Evaluation Complete</Label>
                      <p className="text-sm text-gray-600">When AI evaluation finishes processing</p>
                    </div>
                    <Switch
                      checked={formData.notifications.evaluationComplete}
                      onCheckedChange={(checked) => handleNestedChange('notifications', 'evaluationComplete', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Weekly Reports</Label>
                      <p className="text-sm text-gray-600">Weekly summary of your hiring activity</p>
                    </div>
                    <Switch
                      checked={formData.notifications.weeklyReport}
                      onCheckedChange={(checked) => handleNestedChange('notifications', 'weeklyReport', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>System Updates</Label>
                      <p className="text-sm text-gray-600">Product updates and feature announcements</p>
                    </div>
                    <Switch
                      checked={formData.notifications.systemUpdates}
                      onCheckedChange={(checked) => handleNestedChange('notifications', 'systemUpdates', checked)}
                    />
                  </div>
                </div>

                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <SettingsIcon className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield className="w-5 h-5 mr-2" />
                    Security Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input id="currentPassword" type="password" placeholder="Enter current password" />
                  </div>

                  <div>
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input id="newPassword" type="password" placeholder="Enter new password" />
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input id="confirmPassword" type="password" placeholder="Confirm new password" />
                  </div>

                  <Button>Update Password</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Privacy Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Analytics Tracking</Label>
                      <p className="text-sm text-gray-600">Help improve our service with usage analytics</p>
                    </div>
                    <Switch
                      checked={formData.privacy.analyticsTracking}
                      onCheckedChange={(checked) => handleNestedChange('privacy', 'analyticsTracking', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Data Profiling</Label>
                      <p className="text-sm text-gray-600">Allow data analysis for service optimization</p>
                    </div>
                    <Switch
                      checked={formData.privacy.dataProfiling}
                      onCheckedChange={(checked) => handleNestedChange('privacy', 'dataProfiling', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Third-party Integrations</Label>
                      <p className="text-sm text-gray-600">Enable integrations with partner services</p>
                    </div>
                    <Switch
                      checked={formData.privacy.thirdPartyIntegrations}
                      onCheckedChange={(checked) => handleNestedChange('privacy', 'thirdPartyIntegrations', checked)}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* API Tab */}
          {activeTab === 'api' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Key className="w-5 h-5 mr-2" />
                  API Keys & Integrations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center">
                    <AlertCircle className="w-4 h-4 text-yellow-600 mr-2" />
                    <span className="text-sm font-medium text-yellow-800">Keep your API keys secure</span>
                  </div>
                  <p className="text-sm text-yellow-700 mt-1">
                    Never share your API keys publicly or commit them to version control.
                  </p>
                </div>

                <div>
                  <Label>Production API Key</Label>
                  <div className="flex space-x-2 mt-2">
                    <Input 
                      value="hr_live_ck_test_4WS1aXnHdD7d1ZdVfFaFPdgOyRISsmqf" 
                      readOnly 
                      className="font-mono text-sm"
                    />
                    <Button variant="outline">Copy</Button>
                    <Button variant="outline">Regenerate</Button>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Last used: 2 hours ago
                  </p>
                </div>

                <div>
                  <Label>Test API Key</Label>
                  <div className="flex space-x-2 mt-2">
                    <Input 
                      value="hr_test_ck_test_7YT2bZoIdE8e2AeWgGbGQehPzRJTtmrg" 
                      readOnly 
                      className="font-mono text-sm"
                    />
                    <Button variant="outline">Copy</Button>
                    <Button variant="outline">Regenerate</Button>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Last used: Never
                  </p>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Webhook Endpoints</h4>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Evaluation Complete</Label>
                        <p className="text-sm text-gray-600">https://api.yourcompany.com/webhooks/evaluation</p>
                      </div>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                  </div>
                  <Button variant="outline">Add Webhook</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}