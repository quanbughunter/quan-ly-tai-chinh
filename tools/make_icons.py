"""Đã đổi tên: logo QLTC mới nằm ở tools/make_logo.py. File này chỉ để lệnh cũ vẫn chạy được."""
import os
import runpy

runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'make_logo.py'), run_name='__main__')
