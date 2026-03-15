#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime
import time

class TrucoAPITester:
    def __init__(self, base_url="https://truco-live.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.admin_token = None
        self.user_id = None
        self.admin_id = None
        self.tests_run = 0
        self.tests_passed = 0
        
        # Test user credentials
        timestamp = int(time.time())
        self.test_user = {
            "username": f"testuser_{timestamp}",
            "email": f"test_{timestamp}@test.com",
            "password": "testpass123"
        }
        
        # Admin credentials
        self.admin_credentials = {
            "email": "admin@trucoargentino.com",
            "password": "admin123"
        }
        
        print(f"🎯 Testing Truco Argentino API at: {self.base_url}")
        print(f"📝 Test user: {self.test_user['email']}")
        print("=" * 60)

    def run_test(self, name, method, endpoint, expected_status=200, data=None, headers=None, description=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        
        default_headers = {'Content-Type': 'application/json'}
        if self.token:
            default_headers['Authorization'] = f'Bearer {self.token}'
        if self.admin_token and headers and 'admin' in str(headers):
            default_headers['Authorization'] = f'Bearer {self.admin_token}'
        if headers:
            default_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Test #{self.tests_run}: {name}")
        if description:
            print(f"   📄 {description}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=default_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=default_headers, timeout=10)

            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"   ✅ PASSED - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"   ❌ FAILED - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   📄 Error: {error_data}")
                except:
                    print(f"   📄 Raw response: {response.text[:200]}")
                return False, {}

        except requests.exceptions.RequestException as e:
            print(f"   ❌ FAILED - Network Error: {str(e)}")
            return False, {}
        except Exception as e:
            print(f"   ❌ FAILED - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test basic API health"""
        print("\n🏥 HEALTH CHECKS")
        print("-" * 30)
        
        # Root endpoint
        self.run_test("API Root", "GET", "", 200, description="Check API is running")
        
        # Health endpoint
        self.run_test("Health Check", "GET", "health", 200, description="Verify service health")

    def test_user_registration(self):
        """Test user registration flow"""
        print("\n👤 USER REGISTRATION")
        print("-" * 30)
        
        success, response = self.run_test(
            "User Registration", 
            "POST", 
            "auth/register", 
            200,
            data=self.test_user,
            description="Register new user account"
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            print(f"   🔑 Got user token: {self.token[:20]}...")
            print(f"   👤 User ID: {self.user_id}")
            return True
        
        return False

    def test_admin_login(self):
        """Test admin login"""
        print("\n🔐 ADMIN AUTHENTICATION")
        print("-" * 30)
        
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data=self.admin_credentials,
            description="Login with admin credentials"
        )
        
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            self.admin_id = response['user']['id']
            print(f"   🔑 Got admin token: {self.admin_token[:20]}...")
            print(f"   👨‍💼 Admin ID: {self.admin_id}")
            return True
        
        return False

    def test_user_login(self):
        """Test regular user login"""
        print("\n🔑 USER LOGIN")
        print("-" * 30)
        
        # First clear token to test login
        old_token = self.token
        self.token = None
        
        success, response = self.run_test(
            "User Login",
            "POST", 
            "auth/login",
            200,
            data={
                "email": self.test_user["email"],
                "password": self.test_user["password"]
            },
            description="Login with registered user"
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   🔑 New token: {self.token[:20]}...")
            return True
        else:
            # Restore old token if login failed
            self.token = old_token
            return False

    def test_user_profile(self):
        """Test user profile endpoints"""
        print("\n👤 USER PROFILE")
        print("-" * 30)
        
        self.run_test(
            "Get Current User", 
            "GET", 
            "auth/me", 
            200,
            description="Fetch current user profile"
        )

    def test_cashbank_system(self):
        """Test deposit and cashbank system"""
        print("\n💰 CASHBANK SYSTEM")
        print("-" * 30)
        
        # Get transfer data
        self.run_test(
            "Get Transfer Data",
            "GET",
            "cashbank/transfer-data",
            200,
            description="Get bank transfer information"
        )
        
        # Create deposit
        deposit_data = {"amount": 1000.0}
        success, response = self.run_test(
            "Create Deposit",
            "POST",
            "cashbank/deposit",
            200,
            data=deposit_data,
            description="Create deposit request"
        )
        
        deposit_id = None
        if success and 'id' in response:
            deposit_id = response['id']
            print(f"   💳 Deposit ID: {deposit_id}")
        
        # Get user deposits
        self.run_test(
            "Get User Deposits",
            "GET",
            "cashbank/deposits",
            200,
            description="List user's deposits"
        )
        
        return deposit_id

    def test_admin_functions(self, deposit_id=None):
        """Test admin-only functions"""
        print("\n👨‍💼 ADMIN FUNCTIONS")
        print("-" * 30)
        
        # Temporarily switch to admin token
        original_token = self.token
        self.token = self.admin_token
        
        # Get all deposits
        self.run_test(
            "Admin - Get All Deposits",
            "GET",
            "admin/deposits",
            200,
            description="Admin view all deposits"
        )
        
        # Get all users
        self.run_test(
            "Admin - Get All Users",
            "GET",
            "admin/users",
            200,
            description="Admin view all users"
        )
        
        # Approve deposit if we have one
        if deposit_id:
            self.run_test(
                "Admin - Approve Deposit",
                "PUT",
                f"admin/deposits/{deposit_id}",
                200,
                data={"status": "approved"},
                description="Admin approve deposit"
            )
        
        # Get admin settings
        self.run_test(
            "Admin - Get Settings",
            "GET",
            "admin/settings",
            200,
            description="Get admin settings"
        )
        
        # Update admin settings
        settings_data = {
            "private_table_cost": 150.0,
            "platform_commission": 25.0
        }
        self.run_test(
            "Admin - Update Settings",
            "PUT",
            "admin/settings",
            200,
            data=settings_data,
            description="Update admin settings"
        )
        
        # Restore original token
        self.token = original_token

    def test_table_system(self):
        """Test table creation and management"""
        print("\n🎮 TABLE SYSTEM")  
        print("-" * 30)
        
        # Get available public tables
        self.run_test(
            "Get Available Tables",
            "GET",
            "tables",
            200,
            description="List available public tables"
        )
        
        # Create private table
        private_table_data = {
            "modality": "1v1",
            "entry_cost": 100.0,
            "with_flor": False,
            "points_to_win": 15
        }
        
        success, response = self.run_test(
            "Create Private Table",
            "POST",
            "tables/private",
            200,
            data=private_table_data,
            description="Create private table"
        )
        
        table_code = None
        if success and 'code' in response:
            table_code = response['code']
            print(f"   🎯 Table code: {table_code}")
        
        # Test admin creating public table
        original_token = self.token
        self.token = self.admin_token
        
        public_table_data = {
            "modality": "1v1",
            "entry_cost": 50.0,
            "max_players": 2,
            "with_flor": False,
            "points_to_win": 15
        }
        
        success, response = self.run_test(
            "Admin - Create Public Table",
            "POST", 
            "tables/public",
            200,
            data=public_table_data,
            description="Admin create public table"
        )
        
        public_table_id = None
        if success and 'id' in response:
            public_table_id = response['id']
            print(f"   🏛️ Public table ID: {public_table_id}")
        
        # Get all tables (admin view)
        self.run_test(
            "Admin - Get All Tables",
            "GET",
            "admin/tables",
            200,
            description="Admin view all tables"
        )
        
        self.token = original_token
        return public_table_id, table_code

    def test_chat_system(self):
        """Test chat functionality"""
        print("\n💬 CHAT SYSTEM")
        print("-" * 30)
        
        # Send global message
        message_data = {"content": "Hello from API test!"}
        self.run_test(
            "Send Global Message",
            "POST",
            "chat/global",
            200,
            data=message_data,
            description="Send global chat message"
        )
        
        # Get global messages
        self.run_test(
            "Get Global Messages",
            "GET",
            "chat/global",
            200,
            description="Fetch global chat history"
        )
        
        # Send admin support message
        support_data = {"content": "Need help with my account"}
        self.run_test(
            "Send Admin Support Message",
            "POST", 
            "chat/admin",
            200,
            data=support_data,
            description="Send message to admin support"
        )

    def test_history_endpoints(self):
        """Test history and transaction endpoints"""
        print("\n📊 HISTORY & TRANSACTIONS")
        print("-" * 30)
        
        # Get game history
        self.run_test(
            "Get Game History",
            "GET",
            "history/games", 
            200,
            description="User's game history"
        )
        
        # Get transaction history
        self.run_test(
            "Get Transaction History",
            "GET",
            "history/transactions",
            200,
            description="User's transaction history"
        )

    def run_all_tests(self):
        """Run complete test suite"""
        try:
            # Basic health checks
            self.test_health_check()
            
            # Authentication flow
            if not self.test_user_registration():
                print("❌ User registration failed - stopping tests")
                return False
                
            if not self.test_admin_login():
                print("❌ Admin login failed - continuing with limited tests")
            
            self.test_user_login()
            self.test_user_profile()
            
            # Core functionality
            deposit_id = self.test_cashbank_system()
            
            if self.admin_token:
                self.test_admin_functions(deposit_id)
            
            public_table_id, table_code = self.test_table_system()
            self.test_chat_system() 
            self.test_history_endpoints()
            
            return True
            
        except Exception as e:
            print(f"❌ Test suite failed with error: {str(e)}")
            return False

    def print_summary(self):
        """Print test results summary"""
        print("\n" + "=" * 60)
        print("📋 TEST SUMMARY")
        print("=" * 60)
        print(f"✅ Tests passed: {self.tests_passed}")
        print(f"❌ Tests failed: {self.tests_run - self.tests_passed}")
        print(f"📊 Total tests: {self.tests_run}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success rate: {success_rate:.1f}%")
        
        if success_rate >= 80:
            print("🎉 OVERALL: GOOD - Most functionality working")
        elif success_rate >= 60:
            print("⚠️  OVERALL: MODERATE - Some issues found")
        else:
            print("🚨 OVERALL: POOR - Major issues detected")
        
        return self.tests_passed == self.tests_run

def main():
    print("🃏 TRUCO ARGENTINO API TEST SUITE")
    print(f"🕒 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    tester = TrucoAPITester()
    
    try:
        success = tester.run_all_tests()
        tester.print_summary()
        
        return 0 if success else 1
        
    except KeyboardInterrupt:
        print("\n\n⏹️  Tests interrupted by user")
        tester.print_summary()
        return 1
    except Exception as e:
        print(f"\n\n💥 Test suite crashed: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())