# Used for testing
source 'https://rubygems.org'

gem "rake"
gem "path"
gem "json", "2.2.0"
░░ Support: https://www.debian.org/support
░░
░░ A start job for unit mycodo.service has begun execution.
░░
░░ The job identifier is 3209.
Jan 20 20:04:05 pigrow python[5661]: /var/mycodo-root/env/lib/python3.9/site-packages/flask_marshmallow/__init__.py:26: UserWarning:>
Jan 20 20:04:05 pigrow python[5661]:   warnings.warn(
Jan 20 20:04:05 pigrow python[5661]: Traceback (most recent call last):
Jan 20 20:04:05 pigrow python[5661]:   File "/var/mycodo-root/mycodo/mycodo_daemon.py", line 52, in <module>
Jan 20 20:04:05 pigrow python[5661]:     from mycodo.controllers.controller_conditional import ConditionalController
Jan 20 20:04:05 pigrow python[5661]:   File "/var/mycodo-root/mycodo/controllers/controller_conditional.py", line 33, in <module>
Jan 20 20:04:05 pigrow python[5661]:     from mycodo.controllers.base_controller import AbstractController
Jan 20 20:04:05 pigrow python[5661]:   File "/var/mycodo-root/mycodo/controllers/base_controller.py", line 17, in <module>
Jan 20 20:04:05 pigrow python[5661]:     from mycodo.abstract_base_controller import AbstractBaseController
Jan 20 20:04:05 pigrow python[5661]:   File "/var/mycodo-root/mycodo/abstract_base_controller.py", line 21, in <module>
Jan 20 20:04:05 pigrow python[5661]:     from mycodo.databases.models import Conversion
Jan 20 20:04:05 pigrow python[5661]:   File "/var/mycodo-root/mycodo/databases/models/__init__.py", line 35, in <module>
Jan 20 20:04:05 pigrow python[5661]:     from .controller import CustomController
Jan 20 20:04:05 pigrow python[5661]:   File "/var/mycodo-root/mycodo/databases/models/controller.py", line 34, in <module>
Jan 20 20:04:05 pigrow python[5661]:     class FunctionSchema(ma.SQLAlchemyAutoSchema):
Jan 20 20:04:05 pigrow python[5661]: AttributeError: 'Marshmallow' object has no attribute 'SQLAlchemyAutoSchema'
Jan 20 20:04:05 pigrow systemd[1]: mycodo.service: Control process exited, code=exited, status=1/FAILURE
░░ Subject: Unit process exited
░░ Defined-By: systemd
░░ Support: https://www.debian.org/support
░░
░░ An ExecStart= process belonging to unit mycodo.service has exited.
░░
░░ The process' exit code is 'exited' and its exit status is 1.
Jan 20 20:04:05 pigrow systemd[1]: mycodo.service: Failed with result 'exit-code'.
░░ Subject: Unit failed
░░ Defined-By: systemd
░░ Support: https://www.debian.org/support
░░
░░ The unit mycodo.service has entered the 'failed' state with result 'exit-code'.
Jan 20 20:04:05 pigrow systemd[1]: Failed to start Mycodo server.
░░ Subject: A start job for unit mycodo.service has failed
 ESCOD
Jan 20 20:04:05 pigrow python[5661]:   warnings.warn(
Jan 20 20:04:05 pigrow python[5661]:   warnings.warn(
Jan 20 20:04:05 pigrow python[5661]: Traceback (most recent call last):
Jan 20 20:04:05 pigrow python[5661]:   File "/var/mycodo-root/mycodo/mycodo_daemon.py", line 52, in <module>
Jan 20 20:04:05 pigrow python[5661]:     from mycodo.controllers.controller_conditional import ConditionalController
Jan 20 20:04:05 pigrow python[5661]:   File "/var/mycodo-root/mycodo/controllers/controller_conditional.py", line 33, in <module>
Jan 20 20:04:05 pigrow python[5661]:     from mycodo.controllers.base_controller import AbstractController
Jan 20 20:04:05 pigrow python[5661]:   File "/var/mycodo-root/mycodo/controllers/base_controller.py", line 17, in <module>
Jan 20 20:04:05 pigrow python[5661]:     from mycodo.abstract_base_controller import AbstractBaseController
Jan 20 20:04:05 pigrow python[5661]:   File "/var/mycodo-root/mycodo/abstract_base_controller.py", line 21, in <module>
Jan 20 20:04:05 pigrow python[5661]:     from mycodo.databases.models import Conversion
Jan 20 20:04:05 pigrow python[5661]:   File "/var/mycodo-root/mycodo/databases/models/__init__.py", line 35, in <module>
Jan 20 20:04:05 pigrow python[5661]:     from .controller import CustomController
Jan 20 20:04:05 pigrow python[5661]:   File "/var/mycodo-root/mycodo/databases/models/controller.py", line 34, in <module>
Jan 20 20:04:05 pigrow python[5661]:     class FunctionSchema(ma.SQLAlchemyAutoSchema):
Jan 20 20:04:05 pigrow python[5661]: AttributeError: 'Marshmallow' object has no attribute 'SQLAlchemyAutoSchema'
Jan 20 20:04:05 pigrow systemd[1]: mycodo.service: Control process exited, code=exited, status=1/FAILURE
░░ Subject: Unit process exited
░░ Defined-By: systemd
░░ Support: https://www.debian.org/support
░░
░░ An ExecStart= process belonging to unit mycodo.service has exited.
░░
░░ The process' exit code is 'exited' and its exit status is 1.
Jan 20 20:04:05 pigrow systemd[1]: mycodo.service: Failed with result 'exit-code'.
░░ Subject: Unit failed
░░ Defined-By: systemd
░░ Support: https://www.debian.org/support
░░
░░ The unit mycodo.service has entered the 'failed' state with result 'exit-code'.
Jan 20 20:04:05 pigrow systemd[1]: Failed to start Mycodo server.
░░ Subject: A start job for unit mycodo.service has failed
░░ Defined-By: systemd
░░ Support: https://www.debian.org/support
░░
░░ A start job for unit mycodo.service has finished with a failure.
mycodo@pigrow:~ $ sudo systemctl start mycodo
Job for mycodo.service failed because the control process exited with error code.
See "systemctl status mycodo.service" and "journalctl -xe" for details.
mycodo@pigrow:~ $ journalctl -xe
Jan 20 20:06:44 pigrow rngd[530]: stats: bits sent to kernel pool: 243584
Jan 20 20:06:44 pigrow rngd[530]: stats: entropy added to kernel pool: 243584
Jan 20 20:06:44 pigrow rngd[530]: stats: FIPS 140-2 successes: 15
Jan 20 20:06:44 pigrow rngd[530]: stats: FIPS 140-2 failures: 0
Jan 20 20:06:44 pigrow rngd[530]: stats: FIPS 140-2(2001-10-10) Monobit: 0
Jan 20 20:06:44 pigrow rngd[530]: stats: FIPS 140-2(2001-10-10) Poker: 0
Jan 20 20:06:44 pigrow rngd[530]: stats: FIPS 140-2(2001-10-10) Runs: 0
Jan 20 20:06:44 pigrow rngd[530]: stats: FIPS 140-2(2001-10-10) Long run: 0
Jan 20 20:06:44 pigrow rngd[530]: stats: FIPS 140-2(2001-10-10) Continuous run: 0
Jan 20 20:06:44 pigrow rngd[530]: stats: HRNG source speed: (min=320.200; avg=507.296; max=556.525)Kibits/s
Jan 20 20:06:44 pigrow rngd[530]: stats: FIPS tests speed: (min=3.717; avg=19.301; max=39.085)Mibits/s
Jan 20 20:06:44 pigrow rngd[530]: stats: Lowest ready-buffers level: 2
Jan 20 20:06:44 pigrow rngd[530]: stats: Entropy starvations: 0
Jan 20 20:06:44 pigrow rngd[530]: stats: Time spent starving for entropy: (min=0; avg=0.000; max=0)us
Jan 20 20:06:48 pigrow influxd[445]: ts=2022-01-21T02:06:48.056614Z lvl=info msg="Retention policy deletion check (start)" log_id=0Z>
Jan 20 20:06:48 pigrow influxd[445]: ts=2022-01-21T02:06:48.056791Z lvl=info msg="Retention policy deletion check (end)" log_id=0ZAA>
Jan 20 20:07:19 pigrow gunicorn[3666]: 2022-01-20 20:07:19,032 URL for 'daemon_active' raised and error: cannot connect to ('127.0.0>
Jan 20 20:07:19 pigrow gunicorn[3666]: 2022-01-20 20:07:19,053 URL for 'daemon_active' raised and error: cannot connect to ('127.0.0>
Jan 20 20:08:18 pigrow gunicorn[3666]: 2022-01-20 20:08:18,951 URL for 'daemon_active' raised and error: cannot connect to ('127.0.0>
Jan 20 20:08:19 pigrow gunicorn[3666]: 2022-01-20 20:08:19,005 URL for 'daemon_active' raised and error: cannot connect to ('127.0.0>
Jan 20 20:08:56 pigrow sudo[5713]:   mycodo : TTY=pts/3 ; PWD=/home/mycodo ; USER=root ; COMMAND=/usr/bin/systemctl start mycodo
Jan 20 20:08:56 pigrow sudo[5713]: pam_unix(sudo:session): session opened for user root(uid=0) by mycodo(uid=1001)
Jan 20 20:08:56 pigrow systemd[1]: mycodo.service: Start request repeated too quickly.
Jan 20 20:08:56 pigrow systemd[1]: mycodo.service: Failed with result 'exit-code'.
░░ Subject: Unit failed
░░ Defined-By: systemd
░░ Support: https://www.debian.org/support
░░
░░ The unit mycodo.service has entered the 'failed' state with result 'exit-code'.
Jan 20 20:08:56 pigrow sudo[5713]: pam_unix(sudo:session): session closed for user root
Jan 20 20:08:56 pigrow systemd[1]: Failed to start Mycodo server.
mycodo@pigrow:~ $
mycodo@pigrow:~ $ journalctl -xe
Jan 20 20:06:44 pigrow rngd[530]: stats: FIPS 140-2(2001-10-10) Runs: 0
Jan 20 20:06:44 pigrow rngd[530]: stats: FIPS 140-2(2001-10-10) Long run: 0
Jan 20 20:06:44 pigrow rngd[530]: stats: FIPS 140-2(2001-10-10) Continuous run: 0
Jan 20 20:06:44 pigrow rngd[530]: stats: HRNG source speed: (min=320.200; avg=507.296; max=556.525)Kibits/s
Jan 20 20:06:44 pigrow rngd[530]: stats: FIPS tests speed: (min=3.717; avg=19.301; max=39.085)Mibits/s
Jan 20 20:06:44 pigrow rngd[530]: stats: Lowest ready-buffers level: 2
Jan 20 20:06:44 pigrow rngd[530]: stats: Entropy starvations: 0
Jan 20 20:06:44 pigrow rngd[530]: stats: Time spent starving for entropy: (min=0; avg=0.000; max=0)us
Jan 20 20:06:48 pigrow influxd[445]: ts=2022-01-21T02:06:48.056614Z lvl=info msg="Retention policy deletion check (start)" log_id=0Z>
Jan 20 20:06:48 pigrow influxd[445]: ts=2022-01-21T02:06:48.056791Z lvl=info msg="Retention policy deletion check (end)" log_id=0ZAA>
Jan 20 20:07:19 pigrow gunicorn[3666]: 2022-01-20 20:07:19,032 URL for 'daemon_active' raised and error: cannot connect to ('127.0.0>
Jan 20 20:07:19 pigrow gunicorn[3666]: 2022-01-20 20:07:19,053 URL for 'daemon_active' raised and error: cannot connect to ('127.0.0>
Jan 20 20:08:18 pigrow gunicorn[3666]: 2022-01-20 20:08:18,951 URL for 'daemon_active' raised and error: cannot connect to ('127.0.0>
Jan 20 20:08:19 pigrow gunicorn[3666]: 2022-01-20 20:08:19,005 URL for 'daemon_active' raised and error: cannot connect to ('127.0.0>
Jan 20 20:08:56 pigrow sudo[5713]:   mycodo : TTY=pts/3 ; PWD=/home/mycodo ; USER=root ; COMMAND=/usr/bin/systemctl start mycodo
Jan 20 20:08:56 pigrow sudo[5713]: pam_unix(sudo:session): session opened for user root(uid=0) by mycodo(uid=1001)
Jan 20 20:08:56 pigrow systemd[1]: mycodo.service: Start request repeated too quickly.
Jan 20 20:08:56 pigrow systemd[1]: mycodo.service: Failed with result 'exit-code'.
░░ Subject: Unit failed
░░ Defined-By: systemd
░░ Support: https://www.debian.org/support
░░
░░ The unit mycodo.service has entered the 'failed' state with result 'exit-code'.
Jan 20 20:08:56 pigrow sudo[5713]: pam_unix(sudo:session): session closed for user root
Jan 20 20:08:56 pigrow systemd[1]: Failed to start Mycodo server.
░░ Subject: A start job for unit mycodo.service has failed
░░ Defined-By: systemd
░░ Support: https://www.debian.org/support
░░
░░ A start job for unit mycodo.service has finished with a failure.
░░
░░ The job identifier is 3599 and the job result is failed.
mycodo@pigrow:~ $ journalctl -xe
Jan 20 20:47:58 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:47:58 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:48:08 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:48:08 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:48:09 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:48:09 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:48:10 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:48:10 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:48:12 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:48:12 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:48:13 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:48:13 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:48:23 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:48:23 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:48:24 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:48:24 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:48:25 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:48:25 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:48:27 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:48:27 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:48:28 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:48:28 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:48:38 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:48:38 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:48:39 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:48:39 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:48:40 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:48:40 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:48:42 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:48:42 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:48:43 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:48:43 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:48:53 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:48:53 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:48:54 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:48:54 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:48:55 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:48:55 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:48:57 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:48:57 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:48:58 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:48:58 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:49:08 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:49:08 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:49:09 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:49:09 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:49:10 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:49:10 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:49:12 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:49:12 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:49:13 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:49:13 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:49:23 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:49:23 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:49:24 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:49:24 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:49:25 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:49:25 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:49:27 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:49:27 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
Jan 20 20:49:28 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:49:28 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-">
mycodo@pigrow:~ $ ls
Mycodo
mycodo@pigrow:~ $ ls
Mycodo
mycodo@pigrow:~ $ tail -f /var/log/daemon.log
Jan 20 20:49:23 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:49:23 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-" "python-requests/2.26.0" bd7d5edd-7a64-11ec-885d-dca632dbcdc9 7077
Jan 20 20:49:24 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:49:24 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-" "python-requests/2.26.0" bdfd9e2c-7a64-11ec-885e-dca632dbcdc9 8786
Jan 20 20:49:25 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:49:25 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-" "python-requests/2.26.0" be83a44c-7a64-11ec-885f-dca632dbcdc9 8884
Jan 20 20:49:27 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:49:27 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-" "python-requests/2.26.0" bfe67b0c-7a64-11ec-8860-dca632dbcdc9 6439
Jan 20 20:49:28 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:49:28 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-" "python-requests/2.26.0" c03aa043-7a64-11ec-8861-dca632dbcdc9 5372
Jan 20 20:49:38 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:49:38 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-" "python-requests/2.26.0" c6674057-7a64-11ec-8862-dca632dbcdc9 6712
Jan 20 20:49:39 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:49:39 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-" "python-requests/2.26.0" c6e82d56-7a64-11ec-8863-dca632dbcdc9 7368
Jan 20 20:49:40 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:49:40 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-" "python-requests/2.26.0" c76de283-7a64-11ec-8864-dca632dbcdc9 7232
Jan 20 20:49:42 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:49:42 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-" "python-requests/2.26.0" c8cb5f4c-7a64-11ec-8865-dca632dbcdc9 6834
Jan 20 20:49:43 pigrow influxd[445]: [httpd] ::1 - mycodo [20/Jan/2022:20:49:43 -0600] "POST /write?db=mycodo_db HTTP/1.1" 204 0 "-" "python-requests/2.26.0" c9326f7b-7a64-11ec-8866-dca632dbcdc9 6081
^[[A^[[B^C
mycodo@pigrow:~ $ ls
Mycodo
mycodo@pigrow:~ $ cd Mycodo
mycodo@pigrow:~/Mycodo $ ls
CHANGELOG.md  docker  env      LICENSE.txt  mycodo            README.rst
databases     docs    install  mkdocs.yml   note_attachments  release-checklist.md
mycodo@pigrow:~/Mycodo $ cd env
mycodo@pigrow:~/Mycodo/env $ ls
bin  include  lib  pyvenv.cfg
mycodo@pigrow:~/Mycodo/env $ cd ../mycodo/
mycodo@pigrow:~/Mycodo/mycodo $ ls
abstract_base_controller.py  config.py               flask_session  mycodo_client.py  pyvenv.cfg         user_scripts
babel.cfg                    config_translations.py  functions      mycodo_daemon.py  scripts            utils
bin                          controllers             __init__.py    mycodo_flask      start_flask_ui.py  widgets
config_devices_units.py      databases               inputs         outputs           tests
config_maintenance.py        devices                 lib            __pycache__       user_python_code
mycodo@pigrow:~/Mycodo/mycodo $ cd inputs
mycodo@pigrow:~/Mycodo/mycodo/inputs $ ls
adafruit_i2c_soil.py      bme680_circuitpython.py  max31850k.py                sht1x_7x.py
ads1015_circuitpython.py  bme680.py                max31855.py                 sht2x.py
ads1115_analog_ph_ec.py   bmp180.py                max31856.py                 sht2x_sht20.py
ads1115_circuitpython.py  bmp280_2.py              max31865_circuitpython.py   sht31d_circuitpython.py
ads1256_analog_ph_ec.py   bmp280.py                max31865.py                 sht31_smart_gadget.py




















ads1256.py                ccs811_CP.py             mcp3008.py                  sht3x.py
ads1x15.py                ccs811.py                mcp342x.py                  sht4x_circuitpython.py
adt7410.py                chirp.py                 mcp9808.py                  shtc3_circuitpython.py
adxl34x.py                cozir_co2.py             mh_z16.py                   si1145.py
ahtx0_circuitpython.py    custom_inputs            mh_z19b.py                  si7021_circuitpython.py
am2315.py                 dht11.py                 mh_z19.py                   system_cpuload.py
amg8833.py                dht22.py                 mlx90393_circuitpython.py   system_freespace.py
anyleaf_ec.py             dps310_circuitpython.py  mlx90614.py                 system_server_ping.py
anyleaf_orp.py            ds1822.py                mqtt_paho_json.py           system_server_port_open.py
anyleaf_ph.py             ds1825.py                mqtt_paho.py                tasmota_outlet_energy_monitor.py
as7262.py                 ds18b20_owshell.py       mycodo_ram.py               th1x_am2301.py
atlas_co2.py              ds18b20.py               mycodo_version.py           th1x_ds18b20.py
atlas_do.py               ds18s20.py               __pycache__                 tmp006.py
atlas_ec.py               ds28ea00.py              python_code.py              tsl2561.py
atlas_flow.py             examples                 rpi_cpu_gpu_temperature.py  tsl2591_sensor.py
atlas_humidity.py         grove_temp_humidity.py   rpi_edge.py                 ttn_data_storage.py
atlas_orp.py              hall_flow.py             rpi_gpio_state.py           ttn_data_storage_ttn_v3.py
atlas_ph.py               hcsr04_circuitpython.py  rpi_signal_pwm.py           vl53l0x.py
atlas_pressure.py         hdc1000.py               rpi_signal_revolutions.py   vl53l1x.py
atlas_pt1000.py           htu21d_circuitpython.py  ruuvitag.py                 weather_openweathermap_onecall.py
atlas_rgb.py              htu21d.py                scd30_circuitpython.py      weather_openweathermap_weather.py
base_input.py             ina219x.py               scd30.py                    winsen_zh03b.py
bh1750.py                 __init__.py              scd4x_circuitpython.py      xiaomi_miflora.py
bme280_circuitpython.py   input_spacer.py          scripts                     xiaomi_mijia_lywsd03mmc.py
bme280.py                 k30.py                   sense_hat.py
bme280_rpi_bme280.py      linux_command.py         sensorutils.py
mycodo@pigrow:~/Mycodo/mycodo/inputs $ vi scd
scd30_circuitpython.py  scd30.py                scd4x_circuitpython.py
mycodo@pigrow:~/Mycodo/mycodo/inputs $ vi scd
scd30_circuitpython.py  scd30.py                scd4x_circuitpython.py
mycodo@pigrow:~/Mycodo/mycodo/inputs $ vi scd4x_circuitpython.py
mycodo@pigrow:~/Mycodo/mycodo/inputs $ python
Python 3.9.2 (default, Feb 28 2021, 17:03:44)
[GCC 10.2.1 20210110] on linux
Type "help", "copyright", "credits" or "license" for more information.
>>> import board
>>> import adafruit_scd4x
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
ModuleNotFoundError: No module named 'adafruit_scd4x'
>>>
mycodo@pigrow:~/Mycodo/mycodo/inputs $ ../../e^C
mycodo@pigrow:~/Mycodo/mycodo/inputs $ source ~/Mycodo/env/bin/activate
(env) mycodo@pigrow:~/Mycodo/mycodo/inputs $ python
Python 3.9.2 (default, Feb 28 2021, 17:03:44)
[GCC 10.2.1 20210110] on linux
Type "help", "copyright", "credits" or "license" for more information.
>>> import adafruit_extended_bus
>>> import adafruit_scd4x
>>> i2c = ExtendedI2C(23)
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
NameError: name 'ExtendedI2C' is not defined
>>> i2c = Extended_I2C(23)
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
NameError: name 'Extended_I2C' is not defined
>>> i2c = ExtendedI2C(23)
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
NameError: name 'ExtendedI2C' is not defined
>>> from adafruit_extended_bus import ExtendedI2C
>>> i2c = ExtendedI2C(23)
>>> sensor = adafruit_scd4x.SCD4X(i2c)
>>> sensor.return_dict
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
AttributeError: 'SCD4X' object has no attribute 'return_dict'
>>> return_dict = sensor.
sensor.CO2                              sensor.persist_settings(                sensor.set_ambient_pressure(
sensor.altitude                         sensor.reinit(                          sensor.start_low_periodic_measurement(
sensor.data_ready                       sensor.relative_humidity                sensor.start_periodic_measurement(
sensor.factory_reset(                   sensor.self_calibration_enabled         sensor.stop_periodic_measurement(
sensor.force_calibration(               sensor.self_test(                       sensor.temperature
sensor.i2c_device                       sensor.serial_number                    sensor.temperature_offset
>>> return_dict = sensor.
sensor.CO2                              sensor.persist_settings(                sensor.set_ambient_pressure(
sensor.altitude                         sensor.reinit(                          sensor.start_low_periodic_measurement(
sensor.data_ready                       sensor.relative_humidity                sensor.start_periodic_measurement(
sensor.factory_reset(                   sensor.self_calibration_enabled         sensor.stop_periodic_measurement(
sensor.force_calibration(               sensor.self_test(                       sensor.temperature
sensor.i2c_device                       sensor.serial_number                    sensor.temperature_offset
>>> sensor.temperature
>>> print sensor.temperature
  File "<stdin>", line 1
    print sensor.temperature
          ^
SyntaxError: Missing parentheses in call to 'print'. Did you mean print(sensor.temperature)?
>>> print(sensor.temperature)
None
>>> sensor.data_ready
False
>>> sensor.start_periodic_measurement()
>>> sensor.data_ready
False
>>> sensor.data_ready
False
>>> sensor.self_test()
>>> client_loop: send disconnect: Connection reset
PS C:\Users\dr.sub>
