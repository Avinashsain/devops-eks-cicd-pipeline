import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  vus: 20,
  duration: '30s',
};

export default function () {
  const res = http.get('http://k8s-devopsde-devopsto-6adb174330-1984021607.us-east-1.elb.amazonaws.com/health');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
