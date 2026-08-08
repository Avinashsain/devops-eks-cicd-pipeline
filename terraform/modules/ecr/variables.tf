variable "repository_name" {
  type = string
}

variable "expire_untagged_after_days" {
  type    = number
  default = 3
}

variable "tags" {
  type    = map(string)
  default = {}
}
